-- ============================================================================
-- Harden the household waste_logs RLS policy against leaderboard spoofing.
--
-- The additive household policy in 0001 lets any household member write shared
-- rows (using/with check = household membership), but it does NOT constrain
-- user_id. Because waste_logs are the basis of the "Saved Together" leaderboard
-- (summed per user_id), a member issuing a raw PostgREST insert could set
-- user_id to another member and inflate/spoof someone else's total.
--
-- Fix: require user_id = auth.uid() in the WITH CHECK. A member can still read
-- and edit every shared waste_log (USING is unchanged), but can only INSERT /
-- write rows attributed to THEMSELVES — which is the only legitimate case for a
-- waste log. The SECURITY DEFINER household RPCs bypass RLS, so re-tagging
-- household_id on create/join is unaffected.
--
-- pantry_items is intentionally left as-is: the shared pantry is collaboratively
-- editable (member A edits member B's item), which a user_id = auth.uid() check
-- would break, and pantry_items are not leaderboard-scored.
--
-- Idempotent: drops and recreates the single policy.
-- ============================================================================

drop policy if exists waste_logs_household_all on public.waste_logs;
create policy waste_logs_household_all on public.waste_logs
  for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (
    household_id is not null
    and public.is_household_member(household_id)
    and user_id = auth.uid()
  );
