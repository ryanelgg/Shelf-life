-- Bug fix 3a: deleted shared items can linger on other members' devices.
--
-- The realtime DELETE payload only carries the row's primary key when the table
-- is set to REPLICA IDENTITY FULL. Without this, payload.old has no id, the
-- household-realtime listener can't remove the row locally, and a delete made on
-- one phone doesn't propagate to the others until they reload.

alter table public.pantry_items replica identity full;
alter table public.waste_logs   replica identity full;
