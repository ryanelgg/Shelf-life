-- ============================================================================
-- Enable Supabase Realtime for the shared-pantry tables so household members
-- see each other's changes live. Run this once (after 0001_households.sql).
-- Idempotent and non-destructive.
--
-- REPLICA IDENTITY FULL makes the OLD row available on UPDATE/DELETE events,
-- which is required for the household_id=eq.<id> filter to match on deletes
-- (otherwise only the primary key is published and the filter can't evaluate).
-- ============================================================================

alter table public.pantry_items replica identity full;
alter table public.waste_logs   replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pantry_items'
  ) then
    alter publication supabase_realtime add table public.pantry_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waste_logs'
  ) then
    alter publication supabase_realtime add table public.waste_logs;
  end if;
end $$;
