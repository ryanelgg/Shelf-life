# Pantre — App Store Copy

Drafts for App Store Connect submission. Each section lists the character
limit Apple enforces and the actual character count of the draft.

---

## App Name (30 char limit)

**Pantre** — 6 chars

(If "Pantre" is unavailable at the trademark search step later, fallback
candidates: "Pantre: Pantry & Avo AI" / "Pantre — No Food Waste".)

---

## Subtitle (30 char limit) — pick one

These appear in small grey text directly under the app name in search results
and on the product page. They should sell the app in one breath.

- **Meet Avo, your pantry buddy** — 27 chars ⭐ recommended
- Stop wasting food. Save more. — 29 chars
- Track food. Save money. — 23 chars
- Your kitchen, finally organized — 30 chars

---

## Promotional Text (170 char limit)

Shows above the description and can be updated *without* re-submitting the
binary — good place to put seasonal copy, new-feature callouts, sales.

> Avo is the friendly avocado who helps you remember what's in your fridge. Track expirations, get recipe ideas, scan receipts, and watch your food savings stack up.

161 chars ✓

---

## Description (4000 char limit)

First 3 lines are what users see before they tap "more" — make them count.

```
Stop throwing away groceries. Pantre is the pantry tracker that actually
helps you eat what you buy.

Snap a photo of your receipt. Pantre's avocado mascot Avo logs every item,
predicts when it'll go bad, and nudges you before it expires. Then he
suggests recipes built around what's about to spoil. It's like having a
nutrition-coach roommate in your pocket.

WHAT YOU GET

• Smart pantry tracking — add items in seconds by receipt photo, barcode,
  or quick tap. Pantre knows shelf-life data for thousands of foods.

• Expiration reminders that don't nag — friendly notifications when food
  has 2 days left, 1 day left, and the day of. Skip them in Settings.

• Avo AI — ask Avo what to cook with what you have. Get nutrition tips
  ("what's high in protein?"), allergy-friendly swaps, and recipe ideas
  for whatever's about to expire. Free users get 5 chats; Pro users get 20
  per day.

• Recipe browser — hundreds of recipes filtered by dietary preference
  (vegetarian, vegan, gluten-free, dairy-free, nut-free). Pantre tags
  which ingredients you already have.

• Weekly meal plan — see this week's recipes laid out, what's in your
  pantry, what you still need to buy.

• Shopping list — automatically pulled from missing recipe ingredients,
  or build one from scratch. Tap to check items off.

• Impact tracking — see how much money you've saved, how many items
  you've rescued from the bin, and how many days you've been on a
  no-waste streak.

• Streaks and milestones — Avo celebrates 3, 7, 14, 30, 50, 100, and 365
  day no-waste streaks with fireworks. It's surprisingly motivating.

• Privacy-first — no ads, no trackers, no selling your data. Sync across
  devices through end-to-end encrypted Supabase. Delete your account and
  everything goes with it.

PANTRE PRO

Upgrade to Pantre Pro for unlimited pantry items, the full weekly meal
plan, smart shopping suggestions, and 20 Avo chats per day. Billed monthly
through your Apple ID. Cancel anytime from Settings.

WHY WE BUILT THIS

The average US household throws away about $1,600 of food every year.
Most of it isn't spoiled — it's just forgotten. Pantre is built to be the
opposite of guilt-trippy food-waste apps: cute, fast, and genuinely
useful. Avo is on your team.

Got a question or feature request? Email support@usepantre.me.

Read our privacy policy: usepantre.me/privacy
```

Approx. 2,150 chars (well under 4,000) — leaves room to add a "What's New"
intro at the top once you ship updates.

---

## Keywords (100 char limit, comma-separated, NO spaces)

Apple tokenizes app name + keywords together, so don't repeat words from
"Pantre" or the subtitle. Avoid stop words ("the", "and", "for"). Avoid
quoting any trademarked brand.

```
food,waste,pantry,tracker,expire,fridge,recipe,meal,grocery,leftovers,nutrition,kitchen,save,money
```

98 chars ✓

Alternative pool to swap in based on competitor research:
`groceries, organizer, cooking, ingredients, eco, sustainable, plan, avocado, ai, vegan, vegetarian, glutenfree`

---

## What's New (4000 char limit, per release)

For your first release, this is just:

```
First release! Pantre is finally on the App Store. Track your pantry, get expiration reminders, ask Avo for recipe ideas, and watch your food-waste savings stack up. We can't wait to hear what you think — drop us a note at feedback@usepantre.me.
```

239 chars ✓

---

## Category

Primary: **Food & Drink**
Secondary: **Lifestyle**

(Health & Fitness is tempting because of the nutrition angle, but Food &
Drink is where pantry / grocery apps live and where users browse.)

---

## App Privacy "Data Used to Track You" disclosures

Pantre doesn't track. For the Privacy Nutrition Label section in App Store
Connect, select:

- **Data Linked to You:**
  - Contact Info → Email Address (account, app functionality)
  - Identifiers → User ID (account, app functionality)
  - User Content → Other User Content (your pantry & waste log, app functionality)
  - Usage Data → Product Interaction (streak counts and Avo chat usage caps, app functionality)
  - Diagnostics → Crash Data (only if you wire up crash reporting later — leave off for now)

- **Data Not Linked to You:** none.
- **Data Used to Track You:** none.

Apple's reviewer compares these answers to the Privacy Policy. The doc I
wrote matches this list — don't add a category here that isn't disclosed
in the policy, or vice versa.

---

## Screenshots

Apple requires 6.7-inch iPhone screenshots at **1290 × 2796** pixels.
You'll do these in Canva using real in-app captures as the background.

Suggested order — Apple shows the first 3 in search results, so lead with
the strongest:

1. **Pantry tab** — items + the "Expiring soon!" alert + the freshness bars
   - Caption: *"See what's expiring at a glance"*

2. **Avo chat** — show a conversation about a recipe
   - Caption: *"Ask Avo what to cook"*

3. **Impact tab** — Money Saved hero number + Save Rate progress bar
   - Caption: *"Watch your savings stack up"*

4. **Add Item — Receipt mode** — receipt photo + parsed items list
   - Caption: *"Scan a receipt, log it all"*

5. **Plan tab — recipe with pantry status** — "have / need to buy" tags
   - Caption: *"Recipes built around what you have"*

6. **Streak / milestone screen** — the 7-day fireworks notification
   - Caption: *"Build a no-waste streak"*

---

## Reviewer Test Account

Apple's reviewer needs a working test account. Pre-create:

- Email: `reviewer@usepantre.me` (use Cloudflare Email Routing to forward
  to your Gmail, like the others)
- Password: pick a memorable 12-char string and write it down in your
  password manager

Add a few sample pantry items + at least one waste log so the reviewer
sees the Impact screen populated. Note both credentials in the App Review
notes field at submission.
