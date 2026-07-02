-- 7-day Avo trial support.
--
-- avo_trial_started_at : date the user's 7-day Avo trial began (null = not yet).
-- avo_free_chats_used  : lifetime free-tier Avo allotment, counted only AFTER
--                        the trial ends. Kept separate from avo_chat_count (the
--                        daily counter used by Pro + active-trial users) so a
--                        trial→free or Pro→free transition can't lock a user out
--                        with a stale daily count.

alter table public.profiles
  add column if not exists avo_trial_started_at date,
  add column if not exists avo_free_chats_used integer not null default 0;

-- Backfill: for existing FREE users, avo_chat_count WAS their lifetime free
-- count, so carry it into the new lifetime column. (Pro users use the daily
-- counter, so nothing to migrate for them.)
update public.profiles
  set avo_free_chats_used = avo_chat_count
  where subscription_tier = 'free'
    and avo_free_chats_used = 0
    and avo_chat_count > 0;
