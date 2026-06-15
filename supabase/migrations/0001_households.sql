-- ============================================================================
-- Households — shared pantry for up to 4 connected accounts.
--
-- Model (confirmed product decisions):
--   * One SHARED pantry: every member sees and edits the same items/waste logs.
--   * Creator must be Pantre Pro; invited members join for FREE.
--   * Max 4 members TOTAL (creator + 3 invites).
--
-- Run this once in the Supabase SQL editor (or via the CLI). It is idempotent.
--
-- SECURITY: the Pro requirement and the 4-member cap are enforced HERE, in
-- SECURITY DEFINER functions, NOT in the app — client-side checks would be
-- trivially bypassable with the public anon key.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id) -- a user can belong to at most one household
);

-- Shared rows are tagged with the household. NULL = a normal solo pantry item.
alter table public.pantry_items add column if not exists household_id uuid references public.households(id) on delete set null;
alter table public.waste_logs   add column if not exists household_id uuid references public.households(id) on delete set null;

create index if not exists pantry_items_household_idx   on public.pantry_items(household_id);
create index if not exists waste_logs_household_idx      on public.waste_logs(household_id);
create index if not exists household_members_user_idx    on public.household_members(user_id);

-- ── Helper functions (SECURITY DEFINER avoids RLS recursion) ─────────────────
create or replace function public.is_household_member(hid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function public.my_household_id()
returns uuid language sql security definer stable set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid() limit 1;
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.households        enable row level security;
alter table public.household_members enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (public.is_household_member(id));

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select using (public.is_household_member(household_id));
-- (All writes to these two tables go through the SECURITY DEFINER RPCs below,
--  so no insert/update/delete policies are intentionally granted.)

-- Additive PERMISSIVE policies: existing "user_id = auth.uid()" policies on
-- pantry_items / waste_logs keep working for solo items; these add access to
-- shared household rows. (PERMISSIVE policies combine with OR.)
drop policy if exists pantry_items_household_all on public.pantry_items;
create policy pantry_items_household_all on public.pantry_items
  for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

drop policy if exists waste_logs_household_all on public.waste_logs;
create policy waste_logs_household_all on public.waste_logs
  for all
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

-- ── RPC: create a household (Pro only) ───────────────────────────────────────
create or replace function public.create_household()
returns public.households language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_tier      text;
  v_existing  uuid;
  v_code      text;
  v_household public.households;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select household_id into v_existing from public.household_members where user_id = v_uid;
  if v_existing is not null then raise exception 'You are already in a household'; end if;

  select subscription_tier into v_tier from public.profiles where id = v_uid;
  if coalesce(v_tier, 'free') <> 'pro' then
    raise exception 'Creating a household requires Pantre Pro';
  end if;

  -- unique, human-friendly 6-char invite code (no ambiguous 0/O/1/I/L chars)
  loop
    v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=oO0lI1', 'ABCDEFGHJ'), 1, 6));
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  insert into public.households (owner_id, invite_code) values (v_uid, v_code) returning * into v_household;
  insert into public.household_members (household_id, user_id, role) values (v_household.id, v_uid, 'owner');

  -- the creator's existing pantry becomes the shared household pantry
  update public.pantry_items set household_id = v_household.id where user_id = v_uid and household_id is null;
  update public.waste_logs   set household_id = v_household.id where user_id = v_uid and household_id is null;

  return v_household;
end;
$$;

-- ── RPC: join a household by invite code (free; enforces 4-member cap) ────────
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

  select * into v_household from public.households where invite_code = upper(trim(p_code));
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

-- ── RPC: leave the current household ─────────────────────────────────────────
create or replace function public.leave_household()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_hid       uuid;
  v_role      text;
  v_next      uuid;
  v_remaining int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select household_id, role into v_hid, v_role from public.household_members where user_id = v_uid;
  if v_hid is null then return; end if;

  -- the leaver reclaims the items they personally added
  update public.pantry_items set household_id = null where household_id = v_hid and user_id = v_uid;
  update public.waste_logs   set household_id = null where household_id = v_hid and user_id = v_uid;

  delete from public.household_members where household_id = v_hid and user_id = v_uid;

  select count(*) into v_remaining from public.household_members where household_id = v_hid;

  if v_remaining = 0 then
    -- last one out: disband and release any remaining shared rows to their owners
    update public.pantry_items set household_id = null where household_id = v_hid;
    update public.waste_logs   set household_id = null where household_id = v_hid;
    delete from public.households where id = v_hid;
  elsif v_role = 'owner' then
    -- hand ownership to the longest-standing remaining member
    select user_id into v_next from public.household_members where household_id = v_hid order by joined_at asc limit 1;
    update public.household_members set role = 'owner' where household_id = v_hid and user_id = v_next;
    update public.households set owner_id = v_next where id = v_hid;
  end if;
end;
$$;

-- ── RPC: list members of my household (with names) ───────────────────────────
create or replace function public.household_members_info()
returns table (user_id uuid, name text, role text)
language sql security definer stable set search_path = public as $$
  select m.user_id, p.name, m.role
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  where m.household_id = public.my_household_id()
  order by m.joined_at asc;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
grant execute on function public.is_household_member(uuid)   to authenticated;
grant execute on function public.my_household_id()           to authenticated;
grant execute on function public.create_household()          to authenticated;
grant execute on function public.join_household(text)        to authenticated;
grant execute on function public.leave_household()           to authenticated;
grant execute on function public.household_members_info()    to authenticated;
