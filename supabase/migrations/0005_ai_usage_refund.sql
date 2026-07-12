-- AI usage refund
-- Complements increment_ai_usage (0003): when an AI edge function counts a use
-- but the downstream provider call then fails, the function refunds that use so
-- the user isn't charged against their daily ceiling for a request that never
-- produced a result. Additive and idempotent-safe (never drops below 0). Only
-- the service role (used by the edge functions) may call it.

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
    set count = greatest(0, public.ai_usage.count - 1)
    where user_id = p_user_id
      and usage_date = (now() at time zone 'utc')::date
      and kind = p_kind;
end;
$$;

revoke all on function public.decrement_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.decrement_ai_usage(uuid, text) to service_role;
