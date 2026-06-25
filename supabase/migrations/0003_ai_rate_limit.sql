-- Per-user, server-side rate limiting for the AI edge functions
-- (avo-chat, receipt-ocr, fridge-scan).
--
-- The client/tier limits (5 free chats, 20/day Pro) live in app state and are
-- trivially bypassable by anyone holding the public anon key. This table + RPC
-- are the authoritative ceiling that actually protects the AI spend: every AI
-- call must belong to a signed-in user and must pass the minute/hour/day caps.

create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_user_fn_time_idx
  on public.ai_usage (user_id, function_name, created_at desc);

-- Only the service role (used by the edge functions) ever touches this table.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Atomic check-and-record. Returns true if the call is allowed (and records it),
-- false if any of the minute / hour / day ceilings is already met.
create or replace function public.check_ai_rate_limit(
  p_user       uuid,
  p_function   text,
  p_per_minute int,
  p_per_hour   int,
  p_per_day    int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute int;
  v_hour   int;
  v_day    int;
begin
  if p_user is null then
    return false;
  end if;

  select
    count(*) filter (where created_at > now() - interval '1 minute'),
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*) filter (where created_at > now() - interval '1 day')
  into v_minute, v_hour, v_day
  from public.ai_usage
  where user_id = p_user and function_name = p_function;

  if v_minute >= p_per_minute
     or v_hour >= p_per_hour
     or v_day  >= p_per_day then
    return false;
  end if;

  insert into public.ai_usage (user_id, function_name)
  values (p_user, p_function);

  return true;
end;
$$;

-- Lock the RPC to the service role only (the edge functions). No client role
-- can call it directly.
revoke all on function public.check_ai_rate_limit(uuid, text, int, int, int) from public;
revoke all on function public.check_ai_rate_limit(uuid, text, int, int, int) from anon, authenticated;
grant execute on function public.check_ai_rate_limit(uuid, text, int, int, int) to service_role;

-- Housekeeping helper: drop usage rows older than 2 days (the longest window we
-- count is 1 day) so the table stays tiny. Call from pg_cron if you want it
-- automatic, e.g.:
--   select cron.schedule('prune-ai-usage', '0 4 * * *', 'select public.prune_ai_usage()');
create or replace function public.prune_ai_usage() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_usage where created_at < now() - interval '2 days';
$$;
