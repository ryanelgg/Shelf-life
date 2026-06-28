-- Bug fix 2a: last-write-wins for shared pantry edits.
--
-- Without a per-item timestamp, any realtime echo overwrites the local copy,
-- so a fast local edit can be clobbered by a slightly-delayed update from
-- another phone. The client now stamps every write with updated_at, and the
-- realtime listener only applies an incoming change when it's newer than what
-- the device already has. Existing rows default to now().

alter table public.pantry_items
  add column if not exists updated_at timestamptz not null default now();
