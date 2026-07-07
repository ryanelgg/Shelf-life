-- Lets an edge function refund a counted AI use when the upstream provider
-- call itself fails (missing config, non-2xx response, thrown error) — the
-- daily ceiling in increment_ai_usage is an abuse backstop, not something a
-- user should be charged against for a failure that wasn't their fault.
create or replace function public.decrement_ai_usage(
  p_user_id uuid,
  p_kind    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_usage
    set count = greatest(count - 1, 0)
    where user_id = p_user_id
      and usage_date = (now() at time zone 'utc')::date
      and kind = p_kind;
end;
$$;

revoke all on function public.decrement_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.decrement_ai_usage(uuid, text) to service_role;
