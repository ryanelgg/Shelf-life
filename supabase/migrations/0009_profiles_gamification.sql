-- Profile gamification fields for badges, the weekly Impact Card, and the
-- Profile screen. All additive and nullable/defaulted so existing rows and
-- older app builds keep working.

alter table public.profiles
  add column if not exists avatar       text,
  add column if not exists best_streak  integer not null default 0,
  add column if not exists card_theme   text;
