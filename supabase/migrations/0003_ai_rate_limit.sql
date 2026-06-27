-- AI usage rate limiting
-- Backstop against runaway cost / abuse of the AI edge functions
-- (avo-chat, receipt-ocr, fridge-scan). Each authenticated user gets a
-- per-day, per-function ceiling enforced server-side. This is an ABUSE
-- ceiling, not the product paywall — the free-vs-Pro limits still live in
-- the app. Only the service role (used by the edge functions) touches this.

create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  kind       text not null,
  count      integer not null default 0,
  primary key (user_id, usage_date, kind)
);

-- Lock the table down: no direct client access. The edge functions reach it
-- through the service role, which bypasses RLS.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Atomically count one use and report whether the caller is within the limit.
-- Race-safe: the upsert takes a row lock, so concurrent calls serialize and a
-- caller can never slip past the ceiling by firing requests in parallel. If a
-- call would exceed the limit, the increment is rolled back so the stored
-- count never drifts above the cap.
create or replace function public.increment_ai_usage(
  p_user_id uuid,
  p_kind    text,
  p_limit   integer
)
returns table (allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.ai_usage (user_id, kind, count)
  values (p_user_id, p_kind, 1)
  on conflict (user_id, usage_date, kind)
  do update set count = public.ai_usage.count + 1
  returning public.ai_usage.count into v_count;

  if v_count > p_limit then
    update public.ai_usage
      set count = public.ai_usage.count - 1
      where user_id = p_user_id
        and usage_date = (now() at time zone 'utc')::date
        and kind = p_kind;
    return query select false, p_limit;
  else
    return query select true, v_count;
  end if;
end;
$$;

revoke all on function public.increment_ai_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, text, integer) to service_role;
