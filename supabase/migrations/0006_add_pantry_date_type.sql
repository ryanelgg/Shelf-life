-- Adds AB 660-aligned date semantics to pantry items.
-- "use-by" = safety date (don't eat after), "best-by" = quality date.
-- Nullable: a null value means "fall back to the category default" so existing
-- rows need no backfill.
alter table public.pantry_items
  add column if not exists date_type text
  check (date_type in ('use-by', 'best-by'));
