-- Lets a household member (free or Pro) find out, server-side, whether their
-- household's owner currently holds a Pro subscription — needed to exempt
-- free members from the 20-item pantry cap only when the owner is Pro,
-- without letting the client fake it (a free user can't create their own
-- household to begin with; create_household already requires Pro).
create or replace function public.household_owner_is_pro()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(p.subscription_tier, 'free') = 'pro'
  from public.households h
  join public.profiles p on p.id = h.owner_id
  where h.id = public.my_household_id();
$$;

grant execute on function public.household_owner_is_pro() to authenticated;
