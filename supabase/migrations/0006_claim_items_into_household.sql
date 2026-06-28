-- Bug fix 1a: items added before joining a household should join the shared
-- pantry, not silently disappear.
--
-- The client can't re-stamp household_id directly (RLS guards row ownership),
-- so this SECURITY DEFINER function does it: it takes the caller's solo items
-- (their own rows with no household yet) and moves them into the household they
-- currently belong to. Called right after create/join succeeds.

create or replace function public.claim_items_into_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  select household_id into v_household
    from public.household_members
    where user_id = auth.uid()
    limit 1;

  -- Not in a household → nothing to claim.
  if v_household is null then
    return;
  end if;

  update public.pantry_items
    set household_id = v_household
    where user_id = auth.uid() and household_id is null;

  update public.waste_logs
    set household_id = v_household
    where user_id = auth.uid() and household_id is null;
end;
$$;

revoke all on function public.claim_items_into_household() from public, anon;
grant execute on function public.claim_items_into_household() to authenticated;
