-- Community products moderation: stop "last write wins" corruption.
--
-- Before this, submitCommunityProduct did a plain upsert, so whoever scanned a
-- barcode most recently overwrote everyone else's entry — one bad submission
-- silently replaced a correct one for all future users. This adds confirmation
-- counting and a verified flag, and routes submissions through an RPC that
-- refuses to let an unverified entry overwrite a different existing one.
--
-- Idempotent: safe to run more than once.

-- 1. Moderation columns (no-ops if they already exist).
alter table public.community_products
  add column if not exists confirmations integer not null default 1;

alter table public.community_products
  add column if not exists verified boolean not null default false;

alter table public.community_products
  add column if not exists last_validated_at timestamptz;

-- 2. Submission RPC.
--    p_verified = true only when Avo's AI validation actually ran and passed.
create or replace function public.submit_community_product(
  p_barcode      text,
  p_name         text,
  p_brand        text,
  p_category     text,
  p_verified     boolean,
  p_submitted_by uuid
) returns void
language plpgsql
security invoker
as $$
declare
  existing public.community_products%rowtype;
begin
  select * into existing from public.community_products where barcode = p_barcode;

  -- New barcode → just insert it.
  if not found then
    insert into public.community_products
      (barcode, name, brand, category, submitted_by, confirmations, verified, last_validated_at)
    values
      (p_barcode, p_name, p_brand, p_category, p_submitted_by, 1, p_verified, now());
    return;
  end if;

  -- Same product (case-insensitive name + same category) → count a confirmation,
  -- and let a verified submission promote an unverified row.
  if lower(existing.name) = lower(p_name) and existing.category = p_category then
    update public.community_products
      set confirmations    = coalesce(confirmations, 1) + 1,
          verified         = existing.verified or p_verified,
          brand            = coalesce(existing.brand, p_brand),
          last_validated_at = now()
      where barcode = p_barcode;
    return;
  end if;

  -- Different entry → only a verified submission may overwrite an unverified
  -- row. An unverified, conflicting submission is dropped so it can never
  -- clobber existing community data.
  if p_verified and not coalesce(existing.verified, false) then
    update public.community_products
      set name              = p_name,
          brand             = p_brand,
          category          = p_category,
          submitted_by      = p_submitted_by,
          confirmations     = 1,
          verified          = true,
          last_validated_at = now()
      where barcode = p_barcode;
  end if;
end;
$$;

-- 3. Allow the app's clients to call it.
grant execute on function public.submit_community_product(text, text, text, text, boolean, uuid)
  to anon, authenticated;
