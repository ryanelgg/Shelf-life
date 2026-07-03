-- ── Fix: close the TOCTOU race on the household 4-member cap ──────────────────
-- join_household read count(*) and then inserted with no lock on the households
-- row, so two users redeeming the same invite code at the same time could each
-- see v_count = 3 and both insert, producing a 5+ member household (breaking the
-- documented "max 4" invariant and letting extra members ride a single Pro seat).
--
-- Fix: take a row lock on the target household (SELECT ... FOR UPDATE) before
-- counting members. Concurrent joins to the same household now serialize on that
-- lock, so the count check is always evaluated against a stable membership.
create or replace function public.join_household(p_code text)
returns public.households language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_existing  uuid;
  v_household public.households;
  v_count     int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select household_id into v_existing from public.household_members where user_id = v_uid;
  if v_existing is not null then raise exception 'You are already in a household'; end if;

  -- FOR UPDATE serializes concurrent joins to the same household so the cap holds.
  select * into v_household from public.households where invite_code = upper(trim(p_code)) for update;
  if v_household.id is null then raise exception 'Invalid invite code'; end if;

  select count(*) into v_count from public.household_members where household_id = v_household.id;
  if v_count >= 4 then raise exception 'This household is full (max 4 members)'; end if;

  insert into public.household_members (household_id, user_id, role) values (v_household.id, v_uid, 'member');

  -- merge the joiner's existing items into the shared pantry
  update public.pantry_items set household_id = v_household.id where user_id = v_uid and household_id is null;
  update public.waste_logs   set household_id = v_household.id where user_id = v_uid and household_id is null;

  return v_household;
end;
$$;
