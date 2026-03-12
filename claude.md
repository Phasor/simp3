# CLAUDE.md — Tribute Build Spec
## What to build, from what codebase, and why

---

## What is Tribute

Tribute is a findom-native task platform. Doms create tasks, subs pay to perform them, and sustained devotion (spending + task completions) earns proximity to the dom through tiered chat access.

It is NOT a content platform. It is NOT a paid chat platform where you buy time. It is a devotion platform where access is earned through tasks and spending, then granted or revoked monthly based on Tribute Score.

---

## Starting Point: simp3

The codebase to build from is **simp3** (`https://github.com/Phasor/simp3`).

simp3 is a Next.js 15 / React 19 / Supabase app with a complete, production-quality 1-to-1 chat system. It has the right foundation. We are adapting it — not replacing it wholesale.

**Keep everything in simp3 unless this document says otherwise.**

---

## The Core Loop

```
Dom posts X link
  → Sub lands on her Tribute profile
  → Sub sees: task menu + content wall + VIP tier teaser
  → Sub creates account (email OTP)
  → Age verified (Verifymy silent → Yoti selfie if needed)
  → Sub pays to accept a task → THE SEND MOMENT (ceremonial screen)
  → Sub completes task → submits evidence
  → Dom approves in her review inbox
  → Tribute Score updates automatically via Postgres trigger
  → 1st of each month: score recalculated → chat tier assigned
  → VIP: top X% → group channel access
  → VVIP: top N → private DM access (simp3's existing 1-to-1 chat)
  → Sub notified: tier granted or lost + his rank shown if lost
```

---

## Users and Roles

| Term in Tribute | Maps to in simp3 | DB column |
|---|---|---|
| Dom | Creator | `user_type = 'CREATOR'` |
| Sub | Fan | `user_type = 'FAN'` |

Do not rename DB columns. Update display strings in UI only.

---

## ⚡ START HERE — Build Order

**Read this section first. Build in phase order. Do not start Phase 2 until Phase 1 is fully working. Each phase has explicit done criteria — meet them before moving on.**

The rest of this document is the detailed spec for each feature. Use it as reference material as you work through the phases below.

---

### Phase 0 — Clean up simp3 (do this before writing any new code)

Remove the old model. These files/patterns conflict with Tribute and must go first.

- [ ] Delete `src/app/payment/` route entirely
- [ ] Delete `src/components/Navigation.tsx`
- [ ] Delete `src/components/ConditionalNavigation.tsx`
- [ ] Delete `src/components/Footer.tsx`
- [ ] Delete `src/components/ConditionalFooter.tsx`
- [ ] Remove `src/app/creators/` route
- [ ] Audit `src/components/creator/` — remove any components tied to the old payment/discovery model
- [ ] Remove CCBill/Segpay/Epoch references from codebase (search for `processor`, `ccbill`, `segpay`, `epoch`)
- [ ] Remove `min_spend_cents` / `access_window_days` / `checkChatAccess` spend-gating logic
- [ ] Rename all UI strings: "creator" → "dom", "fan" → "sub" (display only — do not change DB column names)

**Done when:** The app still runs (`npm run dev`), chat works, auth works. No references to CCBill/payment tiers remain.

---

### Phase 1 — Database migrations

Run all migrations against the live Supabase project. Full migration list is in the **DB Migration Order** section below.

- [ ] ALTER `profiles` (new columns)
- [ ] DROP `chat_rules`
- [ ] CREATE new enums (`task_type`, `task_status`, `completion_status`, `vip_tier_type`, `threshold_type`)
- [ ] ALTER `media_assets` (add Bunny + wall columns)
- [ ] ALTER `tasks` (add type, status, price_usdc, repetition columns)
- [ ] CREATE `task_completions`
- [ ] CREATE `content_unlocks`
- [ ] CREATE `tribute_scores`
- [ ] CREATE `vip_tiers`
- [ ] CREATE `vip_messages`
- [ ] ALTER `chat_access` (add `tier`, `rank_at_grant`)
- [ ] ALTER `purchases` (drop old columns, add USDC columns, migrate profile_id → fan_id)
- [ ] CREATE `recalculate_tribute_score()` function + trigger
- [ ] CREATE `recalculate_vip_access()` function
- [ ] CREATE all indexes
- [ ] Write RLS policies for all new tables

**Done when:** All tables exist with correct schemas. `recalculate_tribute_score()` can be called manually without error. RLS blocks cross-user reads.

---

### Phase 2 — Auth + onboarding

- [ ] Supabase Auth OTP flow works end to end (email → 6-digit code → session)
- [ ] New `src/app/onboarding/page.tsx` — replaces simp3's existing onboarding
- [ ] Sub onboarding: email → OTP → age verify (Verifymy) → wallet creation (Privy Edge Function) → alias shown
- [ ] Dom onboarding: email → OTP → handle setup (validation: lowercase, alphanumeric + underscores, min 3 chars) → profile builder (banner, tagline, CTA text)
- [ ] `profiles.handle` is set and unique after dom onboarding completes
- [ ] `profiles.wallet_address` is set after sub onboarding completes
- [ ] `profiles.age_verified = true` after Verifymy passes (or Yoti fallback)

**Done when:** A dom can sign up, set her handle, and her profile is accessible at `/[handle]` (even if it's a blank page). A sub can sign up and has a wallet address and alias.

---

### Phase 3 — Navigation

Build all nav components before building any pages that use them.

- [ ] `src/components/WordmarkOnly.tsx` — Tribute logo, no links. Used on public pages.
- [ ] `src/components/SubBottomNav.tsx` — fixed bottom tab bar (Home, Chat, Score, Profile). Hides on Send Moment and task completion.
- [ ] `src/components/DomDashboardNav.tsx` — top tab bar (Overview, Tasks, Subs, Earnings, Settings) + profile pic dropdown. Hamburger on mobile.
- [ ] Update `src/app/layout.tsx` — mount correct nav based on `profile.user_type`. Public routes use their own layout with WordmarkOnly.
- [ ] `src/app/[domHandle]/layout.tsx` — always WordmarkOnly regardless of auth state
- [ ] Send Moment route (`/task/[taskId]/pay`) — explicitly renders with NO nav component at all

**Done when:** Logged-out user visiting `/[domHandle]` sees wordmark only. Logged-in sub sees bottom tab bar. Logged-in dom sees top tab bar. Send Moment has zero navigation.

---

### Phase 4 — Dom profile page

- [ ] `src/app/[domHandle]/page.tsx` — SSR, `revalidate = 60`
- [ ] Fetches dom profile by `profiles.handle`
- [ ] Hero image (banner_image_url), display name, tagline
- [ ] TASKS tab (default): published task cards (title, type icon, price in USDC, points)
- [ ] CONTENT tab: locked content grid (blurred previews, price overlay)
- [ ] VIP teaser strip: "Join my inner circle" copy, locked to non-VIP users
- [ ] If sub not logged in: clicking a task triggers login/signup prompt

**Done when:** Navigating to `/[a-real-dom-handle]` renders a working profile page with tasks listed. Fast on mobile (test with Chrome DevTools throttling).

---

### Phase 5 — Task system

- [ ] Task builder modal in dom dashboard (all 4 types: REPETITION, SUBMISSION, EVIDENCE, CONTENT)
- [ ] REPETITION builder: phrase input + repetition count
- [ ] CONTENT builder: media picker from her uploaded assets
- [ ] Tasks appear on dom profile page after publishing
- [ ] Send Moment screen (`/task/[taskId]/pay`): hero image, dom name, task title, price, mandatory tribute message input, CTA button, ceremonial animation on confirm
- [ ] REPETITION completion UI: counter, paste disabled, auto-submit on count met
- [ ] SUBMISSION completion UI: textarea, paste disabled, submit to inbox
- [ ] EVIDENCE completion UI: photo upload via react-dropzone → Bunny → submit to inbox
- [ ] CONTENT completion: payment IS completion, redirect to unlocked media immediately
- [ ] Dom review inbox: SUBMITTED tasks listed with sub alias, content/image, approve/reject + feedback
- [ ] On approval: `task_completions.status` = APPROVED, trigger fires `recalculate_tribute_score()`

**Done when:** A dom can create a task of each type. A sub can pay, complete, and have it approved. Tribute Score updates after approval.

---

### Phase 6 — Sub score page

- [ ] `src/app/score/[subId]/page.tsx` — public link, `noindex`
- [ ] Shows: tier badge, member since date, spend bracket (range, not exact), tasks completed count, "Verified Tribute Member" stamp
- [ ] No sub name, no photo, no links to find the sub
- [ ] Sub can view their own score from the Score tab in bottom nav

**Done when:** Shareable score link works. Looks credible enough for a sub to send to a dom on X.

---

### Phase 7 — Content wall

- [ ] Media upload in dom dashboard → Hive check → Bunny storage → `media_assets` row
- [ ] Dom can toggle `is_on_wall` and set `price_usdc` per asset
- [ ] Content tab on dom profile: blurred thumbnails for locked assets, price overlay
- [ ] Sub clicks locked asset → Send Moment (payment) → `content_unlocks` row created → sub redirected to full asset
- [ ] Unlocking counts toward Tribute Score (spend component)
- [ ] Token-authenticated Bunny URL generated server-side with short TTL (~5 min) — never proxied through Next.js

**Done when:** Dom can upload a photo, lock it, set a price. Sub can unlock it and view it. The real URL is never exposed to locked users.

---

### Phase 8 — VIP chat

- [ ] Dom configures VIP threshold (top % or top N) and VVIP count in dashboard settings → writes to `vip_tiers`
- [ ] `recalculate_vip_access()` can be triggered manually from `/api/vip/recalculate`
- [ ] VIP group channel: `src/app/chat/vip/[domHandle]/page.tsx` — access-gated, Realtime messages
- [ ] `src/components/chat/VipGroupChannel.tsx` — adapts `useRealtimeChat` for `vip_messages` table
- [ ] VVIP private DMs — simp3's existing 1-to-1 chat, but only accessible if `chat_access.tier = 'PRIVATE'`
- [ ] Access change emails via Resend: granted and lost notifications with rank shown
- [ ] Cron job or Supabase pg_cron to call `recalculate_vip_access()` on the 1st of each month

**Done when:** Dom sets thresholds. After manual trigger, qualifying subs have chat access. Group channel shows messages in real time. Non-VIP sub hitting the channel gets access denied.

---

### Phase 9 — Dashboard + payouts

- [ ] Dom dashboard overview tab: total earnings, active tasks, VIP/VVIP count, monthly GMV chart
- [ ] Sub leaderboard tab: subs ranked by current month Tribute Score (dom-only view)
- [ ] Earnings tab: transaction history, payout request button
- [ ] Sumsub KYC check before first payout — redirect to Sumsub if `kyc_status != 'APPROVED'`
- [ ] Manual payout flow (no automation — just flag the request for admin to process within 24h)

**Done when:** Dom can see her earnings and request a payout. First payout is gated behind Sumsub KYC completion.

---

### Phase 10 — Payments (USDC via Privy)

*Note: Basic payment flow (Send Moment → Privy transaction) should be stubbed in Phase 5 so tasks can be tested. This phase makes it production-ready.*

- [ ] Privy embedded wallet creation working in sub onboarding
- [ ] USDC transaction on Base signs correctly from Privy wallet
- [ ] Privy webhook (`/api/payment/webhook`) verifies signature before processing
- [ ] Webhook writes to both `task_completions` and `purchases`
- [ ] Platform fee (15%) calculated and recorded
- [ ] Dom notified by email (Resend) when task is accepted

**Done when:** Real USDC moves on Base testnet. Webhook receives and processes correctly. 15% fee is recorded.

---

### Phase 11 — QA + launch prep

- [ ] Test full sub flow on a real mobile device (not just browser DevTools)
- [ ] Test dom flow end to end: create task → sub pays → sub submits → dom approves → score updates → VIP recalculates
- [ ] Verify no media URLs ever appear in page source for locked content
- [ ] Verify RLS: sub A cannot read sub B's task completions
- [ ] Admin dashboard: basic table views for users, tasks, transactions, flagged uploads
- [ ] Hive moderation confirmed working (test with a known test image)
- [ ] Age verification both paths tested (Verifymy pass + Yoti fallback)

**Done when:** You would be comfortable putting a real dom in front of this.

---

## What to KEEP from simp3 (unchanged)

- All 9 chat components in `src/components/chat/`
- All chat hooks: `useRealtimeChat`, `useChatAccess`, `useTypingIndicator`, `useOfflineSync`
- `src/app/chat/` routes
- `src/lib/supabase/client.ts` and `server.ts`
- `src/lib/contexts/AuthContext.tsx`
- Supabase Auth (email OTP via Resend)
- Bunny.net integration (`getBunnyStorageUrl`)
- `chat_messages` table (unchanged)
- `conversations` table (unchanged)
- `profiles` table (add columns — see below)
- `src/app/api/upload/` route

---

## What to REMOVE from simp3

These features represent the "pay for timed chat access" model which is NOT how Tribute works. Remove them completely.

- The payment flow that grants `chat_access` based on spending a minimum in a time window
- `src/app/payment/` — delete this route entirely, replace with Tribute's task payment flow
- `chat_rules` table — delete, replaced by `vip_tiers` table
- `min_spend_cents` / `access_window_days` logic in `checkChatAccess`
- CCBill/Segpay/Epoch from the `processor` enum and `purchases` table
- `src/app/creators/` — public creator listing page (not needed, discovery is via X)
- `src/components/creator/` — audit what's here, likely remove or replace
- `src/components/Navigation.tsx` — replace entirely (see Navigation section below)
- `src/components/ConditionalNavigation.tsx` — replace entirely (see Navigation section below)
- `src/components/Footer.tsx` — remove, Tribute has no footer
- `src/components/ConditionalFooter.tsx` — remove

---

## Navigation

Tribute is mobile-first. The existing simp3 top-header hamburger nav is not appropriate. Replace it entirely with the structure below.

The key principle: **navigation is role-aware and context-aware.** Public pages have no nav. The Send Moment has no nav. Authenticated subs get a bottom tab bar. Doms get a dashboard sidebar/tab structure.

---

### Public pages — no navigation

These pages render with NO navigation component at all. No header, no footer, no back button unless specified.

| Route | Nav |
|---|---|
| `/[domHandle]` | Tribute wordmark only (top-left, links to `/`). Login/signup CTA if logged out. |
| `/score/[subId]` | Tribute wordmark only. Nothing else. |
| `/login` | Tribute wordmark only. |
| `/signup` | Tribute wordmark only. |
| `/onboarding` | Tribute wordmark only + step indicator. |

---

### Send Moment — zero navigation

`/task/[taskId]/pay` has **absolutely no navigation**. No back button, no header, no escape. Full screen. The sub must complete or close the tab. This is intentional.

---

### Task completion pages — minimal header only

`/task/[taskId]/complete` shows only:
- Back arrow (left) → returns to dom profile
- Task title (center)
- Nothing else

No tab bar. No logout. No links.

---

### Sub bottom tab bar (authenticated FAN role)

On all sub-facing authenticated pages, show a fixed bottom tab bar. This is the primary nav for subs.

```
[ Home ]  [ Chat ]  [ Score ]  [ Profile ]
```

| Tab | Icon | Route |
|---|---|---|
| Home | House | `/` → redirects to last visited dom profile, or a generic landing if none |
| Chat | MessageCircle | `/chat` — existing simp3 chat inbox |
| Score | Trophy | `/score/[myProfileId]` |
| Profile | User | `/profile` |

**Implementation:**
- Component: `src/components/SubBottomNav.tsx`
- Fixed to bottom: `position: fixed; bottom: 0; left: 0; right: 0`
- Add `padding-bottom: 64px` to page content to avoid overlap
- Active tab highlighted based on `usePathname()`
- Hide on `/task/[taskId]/pay` (Send Moment) and `/task/[taskId]/complete`
- On the chat page: hide bottom nav on mobile (simp3's chat takes full screen). Show on desktop.

---

### Dom top tab bar (authenticated CREATOR role)

On all dom-facing dashboard pages, show a persistent top navigation with the Tribute wordmark and dashboard tabs.

```
Tribute    [ Overview | Tasks | Subs | Earnings | Settings ]    [ Profile pic ]
```

**Desktop layout:** Horizontal tab bar below a slim header.

**Mobile layout:** Slim header with Tribute wordmark + hamburger. Hamburger opens a slide-down menu with the same 5 tabs.

| Tab | Route |
|---|---|
| Overview | `/dashboard` |
| Tasks | `/dashboard/tasks` |
| Subs | `/dashboard/subs` |
| Earnings | `/dashboard/earnings` |
| Settings | `/dashboard/settings` |

**Implementation:**
- Component: `src/components/DomDashboardNav.tsx`
- Active tab highlighted based on `usePathname()`
- Profile picture in top-right corner → dropdown with "View my profile" (links to `/[myHandle]`) and "Logout"

---

### Chat page — inherited from simp3 with one change

The existing simp3 `ConditionalNavigation` hides the top nav on mobile when on `/chat`. Keep this behaviour but adapt it to use the new nav components:

- On `/chat` (desktop): show DomDashboardNav or SubBottomNav as appropriate for role
- On `/chat` (mobile): hide SubBottomNav, show only a slim header with back arrow
- On `/chat/vip/[domHandle]` (VIP group channel): same treatment as `/chat`

---

### Role-based nav mounting in layout

In `src/app/layout.tsx` (or a nested layout), mount nav conditionally based on auth state and role:

```typescript
// Pseudocode — implement in layout
const { profile } = useAuth()

if (!profile) return <WordmarkOnly />          // unauthenticated
if (profile.user_type === 'CREATOR') return <DomDashboardNav />
if (profile.user_type === 'FAN') return <SubBottomNav />
```

Public routes (`/[domHandle]`, `/score/[subId]`) use a separate `src/app/[domHandle]/layout.tsx` that mounts `<WordmarkOnly />` regardless of auth state.

---

## What to ADD (new features)

---

### 1. Task System

**Existing DB tables in simp3 (confirmed from live schema):**

`media_assets`, `tasks`, `purchases`, `profiles`, `chat_access` all already exist with partial schemas. The migrations below are ALTERs and CREATEs as appropriate — do not try to recreate tables that exist.

**Existing enums (do not recreate):** `media_type` (IMAGE, VIDEO), `user_type` (CREATOR, FAN), `processor` (CCBILL, SEGPAY, EPOCH)

**Existing functions (do not recreate):** `current_profile_id()`, `sync_conversation_on_message()`, `update_chat_access()`

```sql
-- =============================================
-- media_assets: ALREADY EXISTS. Add missing columns for Tribute.
-- Existing columns: id, creator_id, type (media_type enum), title,
--   playback_ref, thumbnail_url, file_size, mime_type, created_at
-- =============================================
ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS bunny_url TEXT,            -- token-authenticated CDN URL (replaces playback_ref for new uploads)
  ADD COLUMN IF NOT EXISTS bunny_preview_url TEXT,    -- blurred preview URL for locked display
  ADD COLUMN IF NOT EXISTS price_usdc NUMERIC(18,6),  -- price to unlock on content wall
  ADD COLUMN IF NOT EXISTS is_on_wall BOOLEAN DEFAULT false; -- whether visible on public content tab

-- =============================================
-- tasks: ALREADY EXISTS. Add Tribute-specific columns.
-- Existing columns: id, creator_id, slug, title, description,
--   price_cents, points, media_id, active, created_at, updated_at
-- =============================================
CREATE TYPE task_type AS ENUM ('REPETITION', 'SUBMISSION', 'EVIDENCE', 'CONTENT');
CREATE TYPE task_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type task_type,         -- null on existing rows, required for new
  ADD COLUMN IF NOT EXISTS status task_status DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS price_usdc NUMERIC(18,6),   -- USDC price (replaces price_cents)
  ADD COLUMN IF NOT EXISTS instructions TEXT,           -- what the sub must do
  ADD COLUMN IF NOT EXISTS repetition_phrase TEXT,      -- REPETITION type: phrase to type
  ADD COLUMN IF NOT EXISTS required_repetitions INTEGER; -- REPETITION type: how many times

-- Note: media_id already exists on tasks. points already exists (rename not needed, use as-is).
-- active boolean is replaced by status enum — set all existing active=true rows to PUBLISHED on migration.
UPDATE tasks SET status = 'PUBLISHED' WHERE active = true;
UPDATE tasks SET status = 'ARCHIVED' WHERE active = false;

-- =============================================
-- task_completions: NEW TABLE — does not exist in simp3
-- =============================================
CREATE TYPE completion_status AS ENUM ('ACCEPTED', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  fan_id UUID NOT NULL REFERENCES profiles(id),
  status completion_status NOT NULL DEFAULT 'ACCEPTED',
  payment_tx_hash TEXT,               -- USDC transaction hash
  amount_usdc NUMERIC(18,6),
  tribute_message TEXT NOT NULL,      -- mandatory message written on Send Moment screen
  submission_text TEXT,               -- for SUBMISSION type
  evidence_url TEXT,                  -- Bunny URL for EVIDENCE type
  repetition_count INTEGER,           -- for REPETITION type: count at time of submission
  dom_feedback TEXT,                  -- approval/rejection note
  accepted_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Task types (MVP — 4 types):**

| Type | What the sub does | Verified by | Auto-approve? |
|---|---|---|---|
| REPETITION | Types a phrase N times | Automated counter | Yes |
| SUBMISSION | Writes a personal declaration or confession | Dom reviews text | No |
| EVIDENCE | Uploads a photo proving he did something | Dom reviews image | No |
| CONTENT | Buys a specific photo or video the dom has assigned | Auto on payment | Yes |

**New routes:**
- `src/app/[domHandle]/page.tsx` — public dom profile (SSR, `revalidate = 60`)
- `src/app/task/[taskId]/page.tsx` — task acceptance + payment
- `src/app/task/[taskId]/complete/page.tsx` — task completion interface
- `src/app/dashboard/tasks/page.tsx` — dom's task builder and review inbox

**Task builder (dom-facing):**
- Create task: choose type, write title, description, instructions, set price in USDC, set points awarded on completion
- CONTENT tasks: attach a specific photo or video from her Bunny library. The task title becomes the directive ("Buy my coffee video"). No instructions field needed — the content IS the task.
- Publish / archive tasks
- Review inbox: list of SUBMITTED completions, approve or reject with optional feedback text. CONTENT and REPETITION tasks never appear here — they auto-approve.

**Task completion UI (sub-facing) by type:**

- **REPETITION:** Text input for the phrase. Counter shows "47 / 100". **Paste is disabled** (`onPaste={(e) => e.preventDefault()}`). Sub must physically type every repetition. Auto-submits and auto-approves when count is met.

- **SUBMISSION:** Textarea for personal declaration. **Paste is disabled.** Submit button sends to dom review inbox.

- **EVIDENCE:** Photo upload (react-dropzone already in simp3). File uploads to Bunny via `src/app/api/upload/`. Submit button sends to dom review inbox.

- **CONTENT:** No completion UI needed. Payment IS completion. On successful Privy webhook: `task_completions.status` set to `APPROVED` immediately. Sub is redirected to the unlocked photo or video. Points credited automatically.

---

### 2. The Send Moment (payment screen)

This is the most important screen in the product. When a sub decides to accept a task, this is what he sees.

**Route:** `src/app/task/[taskId]/pay/page.tsx`

**Layout:**
- Dom's hero image fills top 60% of screen
- Dom's display name in large type
- Task title and price in USDC
- Text input: "Write your tribute message to [dom name]" — required, not optional
- CTA button using dom's configured language (default: "Submit Tribute") 
- On confirm: full-screen ceremonial animation held for 3 seconds
- Then: "Your tribute has been received" with AI-generated acknowledgement in dom's voice

**Do not skip the tribute message input. It is mandatory.**

---

### 3. Tribute Score System

**New DB tables:**

```sql
CREATE TABLE tribute_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id),
  dom_id UUID NOT NULL REFERENCES profiles(id),
  total_score INTEGER NOT NULL DEFAULT 0,
  spend_score INTEGER NOT NULL DEFAULT 0,       -- 50% weight
  task_score INTEGER NOT NULL DEFAULT 0,        -- 30% weight
  tenure_score INTEGER NOT NULL DEFAULT 0,      -- 10% weight
  diversity_score INTEGER NOT NULL DEFAULT 0,   -- 10% weight (number of doms paid)
  tier TEXT NOT NULL DEFAULT 'UNVERIFIED',       -- tier badge
  month_year TEXT NOT NULL,                      -- '2026-03' format
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fan_id, dom_id, month_year)
);

-- Score tiers (reference — not enforced by DB, calculated in app)
-- UNVERIFIED: 0 points
-- TRIBUTE_INITIATE: 1-99 points  
-- VERIFIED_PAYER: 100-499 points
-- DEVOTED: 500-1499 points
-- DEDICATED: 1500-4999 points
-- ELITE: 5000+ points
-- (exact thresholds hidden from subs to prevent gaming)
```

**Score calculation Postgres function:**

```sql
CREATE OR REPLACE FUNCTION recalculate_tribute_score(p_fan_id UUID, p_dom_id UUID)
RETURNS void AS $$
DECLARE
  v_spend_usdc NUMERIC;
  v_task_count INTEGER;
  v_first_payment TIMESTAMPTZ;
  v_unique_doms INTEGER;
  v_month TEXT := to_char(now(), 'YYYY-MM');
BEGIN
  -- Lifetime spend with this dom
  SELECT COALESCE(SUM(tc.amount_usdc), 0)
  INTO v_spend_usdc
  FROM task_completions tc
  JOIN tasks t ON tc.task_id = t.id
  WHERE tc.fan_id = p_fan_id 
    AND t.creator_id = p_dom_id
    AND tc.status = 'APPROVED';

  -- Approved task completions with this dom
  SELECT COUNT(*)
  INTO v_task_count
  FROM task_completions tc
  JOIN tasks t ON tc.task_id = t.id
  WHERE tc.fan_id = p_fan_id
    AND t.creator_id = p_dom_id
    AND tc.status = 'APPROVED';

  -- Tenure (when first paid any dom)
  SELECT MIN(created_at) INTO v_first_payment
  FROM task_completions
  WHERE fan_id = p_fan_id AND status = 'APPROVED';

  -- Unique doms paid
  SELECT COUNT(DISTINCT t.creator_id)
  INTO v_unique_doms
  FROM task_completions tc
  JOIN tasks t ON tc.task_id = t.id
  WHERE tc.fan_id = p_fan_id AND tc.status = 'APPROVED';

  INSERT INTO tribute_scores (fan_id, dom_id, spend_score, task_score, tenure_score, diversity_score, total_score, month_year)
  VALUES (
    p_fan_id, p_dom_id,
    LEAST(FLOOR(v_spend_usdc * 10)::INTEGER, 500),                                      -- spend: 1pt per 0.1 USDC, cap 500
    LEAST(v_task_count * 30, 300)::INTEGER,                                             -- tasks: 30pt each, cap 300
    LEAST(EXTRACT(EPOCH FROM (now() - COALESCE(v_first_payment, now())))/86400, 100)::INTEGER,  -- tenure: 1pt/day, cap 100
    LEAST(v_unique_doms * 10, 100)::INTEGER,                                            -- diversity: 10pt per dom, cap 100
    0, -- will be updated below
    v_month
  )
  ON CONFLICT (fan_id, dom_id, month_year) DO UPDATE SET
    spend_score = EXCLUDED.spend_score,
    task_score = EXCLUDED.task_score,
    tenure_score = EXCLUDED.tenure_score,
    diversity_score = EXCLUDED.diversity_score,
    updated_at = now();

  -- Set total
  UPDATE tribute_scores
  SET total_score = spend_score + task_score + tenure_score + diversity_score
  WHERE fan_id = p_fan_id AND dom_id = p_dom_id AND month_year = v_month;

END;
$$ LANGUAGE plpgsql;
```

**Trigger:** Fire `recalculate_tribute_score` after every INSERT on `task_completions` where `status = 'APPROVED'`.

**Sub score page:**
- Route: `src/app/score/[subId]/page.tsx`
- Public via direct link only. `<meta name="robots" content="noindex">`
- Shows: tier badge, member since, spend bracket (range not exact), tasks completed count, verification statement
- No sub name, no photo, no searchability
- Shareable — sub shares this link to doms on X as his credential

---

### 4. VIP Chat Access (replaces simp3's spend-gated model)

This is the most important architectural change from simp3. The chat components and real-time infrastructure are UNCHANGED. Only the access grant mechanism changes.

**New DB tables:**

```sql
CREATE TYPE vip_tier_type AS ENUM ('GROUP', 'PRIVATE');
CREATE TYPE threshold_type AS ENUM ('TOP_PERCENT', 'TOP_N');

CREATE TABLE vip_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dom_id UUID NOT NULL REFERENCES profiles(id),
  tier_type vip_tier_type NOT NULL,
  threshold_type threshold_type NOT NULL,
  threshold_value NUMERIC NOT NULL,   -- percent (e.g. 10.0) or count (e.g. 3)
  reset_day INTEGER DEFAULT 1,        -- day of month access recalculates
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dom_id, tier_type)
);
```

**Replace `chat_rules` with `vip_tiers`.** The existing `chat_access` table is kept but populated differently.

**Full SQL for new VIP tables and functions:**

```sql
-- vip_messages: group channel messages (one channel per dom)
CREATE TABLE vip_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dom_id UUID NOT NULL REFERENCES profiles(id),
  sender_id UUID NOT NULL REFERENCES profiles(id),  -- can be dom or a VIP sub
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vip_messages_dom_id ON vip_messages(dom_id, created_at DESC);

-- Function: recalculate VIP access for all subs of a given dom
-- Run on 1st of each month via cron, or immediately when dom changes thresholds
CREATE OR REPLACE FUNCTION recalculate_vip_access(p_dom_id UUID)
RETURNS void AS $$
DECLARE
  v_month TEXT := to_char(now(), 'YYYY-MM');
  v_month_end TIMESTAMPTZ := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  v_group_tier RECORD;
  v_private_tier RECORD;
  v_total_subs INTEGER;
  v_group_cutoff INTEGER;
  v_private_cutoff INTEGER;
BEGIN
  -- Fetch dom's tier configs
  SELECT * INTO v_group_tier FROM vip_tiers WHERE dom_id = p_dom_id AND tier_type = 'GROUP';
  SELECT * INTO v_private_tier FROM vip_tiers WHERE dom_id = p_dom_id AND tier_type = 'PRIVATE';

  -- Count total distinct subs who have ever paid this dom
  SELECT COUNT(DISTINCT fan_id) INTO v_total_subs
  FROM tribute_scores
  WHERE dom_id = p_dom_id AND month_year = v_month;

  -- Expire all current access for this dom first
  UPDATE chat_access
  SET state = 'expired', updated_at = now()
  WHERE creator_id = p_dom_id AND state = 'granted';

  -- Grant GROUP access
  IF v_group_tier IS NOT NULL THEN
    IF v_group_tier.threshold_type = 'TOP_PERCENT' THEN
      v_group_cutoff := GREATEST(1, FLOOR(v_total_subs * v_group_tier.threshold_value / 100))::INTEGER;
    ELSE
      v_group_cutoff := v_group_tier.threshold_value::INTEGER;
    END IF;

    INSERT INTO chat_access (fan_id, creator_id, tier, state, access_until, rank_at_grant, updated_at)
    SELECT
      ts.fan_id,
      p_dom_id,
      'GROUP',
      'granted',
      v_month_end,
      ROW_NUMBER() OVER (ORDER BY ts.total_score DESC),
      now()
    FROM tribute_scores ts
    WHERE ts.dom_id = p_dom_id AND ts.month_year = v_month
    ORDER BY ts.total_score DESC
    LIMIT v_group_cutoff
    ON CONFLICT (fan_id, creator_id) DO UPDATE SET
      tier = EXCLUDED.tier,
      state = 'granted',
      access_until = EXCLUDED.access_until,
      rank_at_grant = EXCLUDED.rank_at_grant,
      updated_at = now();
  END IF;

  -- Grant PRIVATE access (top N only — always TOP_N threshold)
  IF v_private_tier IS NOT NULL THEN
    v_private_cutoff := v_private_tier.threshold_value::INTEGER;

    INSERT INTO chat_access (fan_id, creator_id, tier, state, access_until, rank_at_grant, updated_at)
    SELECT
      ts.fan_id,
      p_dom_id,
      'PRIVATE',
      'granted',
      v_month_end,
      ROW_NUMBER() OVER (ORDER BY ts.total_score DESC),
      now()
    FROM tribute_scores ts
    WHERE ts.dom_id = p_dom_id AND ts.month_year = v_month
    ORDER BY ts.total_score DESC
    LIMIT v_private_cutoff
    ON CONFLICT (fan_id, creator_id) DO UPDATE SET
      tier = EXCLUDED.tier,  -- upgrade to PRIVATE if already GROUP
      state = 'granted',
      access_until = EXCLUDED.access_until,
      rank_at_grant = EXCLUDED.rank_at_grant,
      updated_at = now();
  END IF;

END;
$$ LANGUAGE plpgsql;
```

**Update `chat_access` table** — `access_until` already exists. Only add the two new columns:

```sql
-- Existing columns in chat_access: id, creator_id, fan_id, state, access_until,
--   last_qualifying_purchase_id, status, created_at, updated_at
-- DO NOT re-add access_until — it already exists.

ALTER TABLE chat_access
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'GROUP',    -- 'GROUP' or 'PRIVATE'
  ADD COLUMN IF NOT EXISTS rank_at_grant INTEGER;        -- sub's rank when access was granted

-- last_qualifying_purchase_id and status columns can be left in place — ignored by Tribute
-- The existing update_chat_access() function will be replaced by recalculate_vip_access()
```

**What changes in the chat access check:**
- `checkChatAccess()` in `src/lib/utils/chatAccess.ts` stays the same
- `chat_access` table is populated by `recalculate_vip_access()` not by individual purchases
- A sub with `chat_access.state = 'granted'` gets VIP GROUP chat
- A sub with PRIVATE tier access gets 1-to-1 DMs (simp3's existing chat thread — unchanged)

**VIP Group Channel:**
- New table: `vip_messages (id, dom_id, sender_id, content, created_at)`
- New component: `src/components/chat/VipGroupChannel.tsx`
- New route: `src/app/chat/vip/[domHandle]/page.tsx`
- Access gate: check `chat_access` for GROUP tier before rendering
- **Supabase Realtime** — messages appear instantly for all connected subs. Adapt the existing `useRealtimeChat` hook for `vip_messages` table. Subscribe to `postgres_changes` on INSERT where `dom_id = X`. No typing indicators needed for group channel.
- Dom can see all VIP members listed in her dashboard

**Sub notification on access change:**
- On `chat_access` update: send email via Resend
- Access granted: "You've earned VIP access to [dom name] this month"
- Access lost: "Your access to [dom name]'s VIP chat has ended. You ranked #[rank]. The top [threshold] qualify."

---

### 5. Dom Profile Page (public, SSR)

**Route:** `src/app/[domHandle]/page.tsx`

This is the landing page subs hit from X links. It must be fast. Server-render it.

```typescript
export const revalidate = 60 // rebuild at most once per minute
```

**Layout (mobile-first):**
- Hero image (full width, 40vh)
- Dom name + tagline
- "TASKS" tab (default) / "CONTENT" tab
- Tasks tab: list of published tasks as cards (title, type icon, price in USDC, points awarded)
- Content tab: locked content grid (blurred previews, price to unlock)
- VIP teaser section: "Join my inner circle. Top [X]% of devoted subs get exclusive access." — locked, shown to all

**Sub must be logged in to pay. If not logged in: show login/signup prompt on task click.**

---

### 5a. Content Wall

The content wall is the passive browsing surface on the dom's profile — distinct from CONTENT tasks. On the wall, subs choose what to buy. In a CONTENT task, the dom directs the sub to buy something specific.

**How it works:**
- Dom uploads photos and videos via her dashboard
- Each asset stored in `media_assets` with `is_locked = true` and `price_usdc` set
- On the dom's public profile, locked assets show as blurred thumbnails with price overlay
- Sub clicks → pays → `media_assets` unlocked for that sub via `content_unlocks` table
- Unlocking content counts toward Tribute Score (spend component) exactly like task payments

**New DB table:**

```sql
CREATE TABLE content_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id),
  media_id UUID NOT NULL REFERENCES media_assets(id),
  payment_tx_hash TEXT,
  amount_usdc NUMERIC(18,6),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fan_id, media_id)             -- can only unlock once
);
```

**Content upload flow (dom-facing):**
1. Dom selects file in dashboard → upload via `src/app/api/upload/route.ts`
2. Hive moderation check runs first (same as all uploads)
3. File stored in Bunny, `media_assets` row created with `is_locked = true`
4. Dom sets price, optionally attaches to a CONTENT task

**Content display (sub-facing):**
- Check `content_unlocks` for `fan_id + media_id` match before serving Bunny URL
- If unlocked: generate token-authenticated Bunny URL (short TTL, ~5 minutes)
- If locked: serve blurred thumbnail only — never the real URL
- Never proxy media bytes through Next.js — generate the signed Bunny URL and redirect

---

### 6. Payments — USDC on Base via Privy

**Replace all payment logic. Remove CCBill/Segpay/Epoch entirely.**

**New payment flow:**
1. Sub clicks task → lands on Send Moment screen
2. Sub writes tribute message (required)
3. Sub confirms → Privy wallet signs USDC transaction on Base
4. Privy webhook hits `src/app/api/payment/webhook/route.ts`
5. Webhook verifies signature, writes to `task_completions` (status: ACCEPTED), writes to `purchases`
6. Dom notified (email via Resend): "A sub has accepted your task '[title]'"

**Update `purchases` table (actual existing columns: id, profile_id, task_id TEXT, amount_cents, processor, processor_tx_id, created_at):**
```sql
-- Drop the old payment processor columns
ALTER TABLE purchases
  DROP COLUMN IF EXISTS processor,
  DROP COLUMN IF EXISTS processor_tx_id,
  DROP COLUMN IF EXISTS amount_cents,
  ADD COLUMN IF NOT EXISTS fan_id UUID REFERENCES profiles(id), -- rename intent: profile_id → fan_id
  ADD COLUMN IF NOT EXISTS usdc_tx_hash TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS amount_usdc NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS purchase_type TEXT; -- 'TASK' or 'CONTENT_UNLOCK'

-- Migrate existing profile_id data to fan_id, then drop profile_id
UPDATE purchases SET fan_id = profile_id WHERE fan_id IS NULL;
ALTER TABLE purchases DROP COLUMN IF EXISTS profile_id;

-- Also drop the processor enum since it's no longer used
-- DROP TYPE processor; -- do this last, after column is dropped
```

**Note:** `task_id` on purchases is currently TEXT — leave as-is for backwards compat, new rows will use UUID string representation.

**Privy is wallet-only.** Supabase Auth handles identity. On sub account creation:
1. Supabase Auth creates user, issues JWT
2. Edge Function calls Privy API to create embedded wallet
3. Wallet address stored on `profiles.wallet_address`

---

### 7. Age Verification

Two-layer stack. Must run before first payment.

**Layer 1 — Verifymy (silent, email-based):**
- Call Verifymy API with sub's email after account creation
- ~85% of users pass here with no friction
- If pass: mark `profiles.age_verified = true`

**Layer 2 — Yoti (selfie):**
- If Verifymy returns inconclusive: redirect to Yoti flow
- 10-second selfie, no document required in first pass
- Yoti webhook updates `profiles.age_verified = true` on success

**Gate:** Payment screen checks `age_verified`. If false, redirect to verification flow first.

**New profile columns (profiles table already exists — these are additions only):**
```sql
-- Existing columns already in profiles: id, auth_user_id, email, created_at, user_type,
--   onboarding_completed, display_name, profile_picture_url, banner_image_url,
--   ccbill_merchant_id, monetization_enabled, about_text
-- DO NOT re-add banner_image_url — it already exists.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE,        -- URL slug e.g. "mistress_elena" → /mistress_elena
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tribute_alias TEXT,        -- randomly generated sub alias e.g. "silent_wolf"
  ADD COLUMN IF NOT EXISTS vip_cta_text TEXT,         -- dom's custom CTA e.g. "Submit Tribute"
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'PENDING'; -- PENDING, SUBMITTED, APPROVED, REJECTED

-- handle is required for doms before they can publish a profile
-- handle is NOT required for subs (they use tribute_alias instead)
-- handle must be lowercase, alphanumeric + underscores only, min 3 chars
-- ccbill_merchant_id and monetization_enabled can be left in place — ignored by Tribute
```

---

### 8. Sub Onboarding

**Route:** `src/app/onboarding/page.tsx` (new, replace simp3's existing onboarding)

**Steps:**
1. Email input
2. OTP verification (Supabase Auth, 6-digit code sent via Resend)
3. Age verification (Verifymy silent → Yoti if needed)
4. Wallet creation (invisible, happens in background via Edge Function)
5. Alias shown: "You are silent_wolf. You can change this in settings."
6. Return to dom profile — ready to pay

**Total target time: under 90 seconds from page load to ready to pay.**

---

### 9. Dom Dashboard

**Route:** `src/app/dashboard/page.tsx` (dom only, auth-gated)

**Sections:**

**Overview tab:**
- Total earnings (USDC)
- Active tasks count
- Current VIP member count / VVIP member count
- Monthly GMV chart (recharts — already in simp3)

**Tasks tab:**
- Published tasks list with: title, type, price, completions count, total earned
- "Create Task" button → task builder modal
- Review Inbox: submitted completions awaiting approval, with sub alias, task title, submission content / evidence image, approve / reject buttons with optional feedback text

**Sub Leaderboard tab:**
- Ranked list of subs by Tribute Score (current month)
- Shows: alias, tier badge, score, tasks completed, total spent
- NOT public — only the dom sees this

**Chat Settings tab:**
- VIP threshold: toggle (top % / top N), value input
- VVIP threshold: top N input
- Preview: "Based on current scores, [X] subs would qualify for VIP, [Y] for VVIP"

**Earnings tab:**
- Transaction history
- Payout request button (manual, triggers KYC check then Sumsub if needed)

---

### 10. Creator KYC (before first payout)

Use Sumsub for ID verification before any USDC payout.

- Check `profiles.kyc_status` before processing payout request
- If not verified: redirect to Sumsub verification flow
- Sumsub webhook updates `profiles.kyc_status = 'APPROVED'`

**Note:** `kyc_status` column is added in the profiles migration in section 7 above. Do not run a separate ALTER here.

---

### 11. Content Moderation

**Hive Moderation on every upload.** This is non-negotiable.

In `src/app/api/upload/route.ts`:
1. Receive file from client
2. Send to Hive API for CSAM detection
3. If flagged: reject upload, quarantine, alert admin
4. If clean: upload to Bunny, return token-authenticated URL

---

## Routes Summary

```
Public (SSR, cached):
  /[domHandle]                  Dom profile page
  /score/[subId]                Sub score page (noindex)

Auth routes:
  /login                        Email input
  /signup                       Account creation
  /onboarding                   Age verification + wallet setup

Sub-facing (auth required):
  /task/[taskId]                Task detail + accept
  /task/[taskId]/pay            Send Moment (payment)
  /task/[taskId]/complete       Task completion interface
  /chat                         Chat inbox (existing simp3)
  /chat/vip/[domHandle]         VIP group channel (new)
  /profile                      Sub profile + score

Dom-facing (auth required, CREATOR role):
  /dashboard                    Creator dashboard
  /dashboard/tasks              Task management + review inbox
  /dashboard/earnings           Earnings + payout
  /dashboard/subs               Sub leaderboard
  /dashboard/settings           Chat tier settings + profile settings

API routes:
  /api/payment/webhook          Privy payment confirmation
  /api/age-verify/callback      Yoti async callback
  /api/upload                   Hive check → Bunny upload (existing)
  /api/vip/recalculate          Monthly VIP access recalculation (cron)
  /api/chat/access/[creator]/[fan]  (existing simp3, unchanged)
```

---

## Route Conflict Note

`/[domHandle]` is a dynamic catch-all at the root level. Next.js resolves route conflicts by specificity — static routes (`/chat`, `/dashboard`, `/login`, `/score`, `/task`, `/onboarding`, `/profile`) always win over dynamic segments. This is intentional and correct. Do not add middleware or special handling. Just ensure all static routes are defined before `[domHandle]` in the file system, which Next.js App Router handles automatically.

---

## DB Migration Order

Run these in order during Phase 1. Do not skip steps — later migrations reference tables created in earlier ones.

1. **ALTER** `profiles` — add: `handle`, `wallet_address`, `age_verified`, `age_verified_at`, `tribute_alias`, `vip_cta_text`, `tagline`, `kyc_status` (banner_image_url already exists — skip it)
2. **DROP** `chat_rules` table
3. **CREATE** enums: `task_type`, `task_status`, `completion_status` (media_type, user_type already exist — skip them)
4. **ALTER** `media_assets` — add: `bunny_url`, `bunny_preview_url`, `price_usdc`, `is_on_wall` (table already exists)
5. **ALTER** `tasks` — add: `task_type`, `status`, `price_usdc`, `instructions`, `repetition_phrase`, `required_repetitions` (table already exists, media_id already exists)
6. **UPDATE** `tasks` — set status = 'PUBLISHED' where active = true, 'ARCHIVED' where active = false
7. **CREATE** `task_completions` table (new)
8. **CREATE** `content_unlocks` table (new)
9. **CREATE** `tribute_scores` table (new)
10. **CREATE** enums: `vip_tier_type`, `threshold_type`
11. **CREATE** `vip_tiers` table (new)
12. **CREATE** `vip_messages` table (new)
13. **ALTER** `chat_access` — add: `tier`, `rank_at_grant` only (access_until already exists — skip it)
14. **ALTER** `purchases` — drop: `processor`, `processor_tx_id`, `amount_cents`; add: `fan_id`, `usdc_tx_hash`, `amount_usdc`, `wallet_address`, `purchase_type`; migrate `profile_id` → `fan_id`; drop `processor` enum
15. **CREATE** `recalculate_tribute_score()` function
16. **CREATE** `recalculate_vip_access()` function (replaces existing `update_chat_access()`)
17. **CREATE** trigger: `task_completions` AFTER UPDATE WHERE status = 'APPROVED' → call `recalculate_tribute_score()`
18. **CREATE** indexes: `tasks(creator_id)`, `task_completions(fan_id, status)`, `tribute_scores(dom_id, month_year, total_score DESC)`, `vip_messages(dom_id, created_at DESC)`, `content_unlocks(fan_id, media_id)`

---

## Supabase RLS Policies

Critical policies to implement:

```sql
-- profiles: public read for doms (needed for profile page), users read/write own row only
-- tasks: anyone can read PUBLISHED tasks, only creator can insert/update/delete
-- task_completions: fan can read own rows, creator can read completions of their tasks only
-- media_assets: anyone can read (thumbnail URL), only creator can insert/update/delete
-- content_unlocks: fan can read own rows, creator can read unlocks of their media
-- tribute_scores: fan can read own score, dom can read scores where dom_id = her id
-- vip_tiers: dom can read/write own tiers only
-- vip_messages: any user with granted chat_access for that dom can read; dom + VIP members can insert
-- chat_access: fan can read own rows, dom can read rows where creator_id = her id
```

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Privy (wallet only)
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_WEBHOOK_SECRET=

# Bunny.net
BUNNY_STORAGE_ZONE=
BUNNY_STORAGE_PASSWORD=
BUNNY_CDN_URL=
BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=

# Age verification
VERIFYMY_API_KEY=
YOTI_SDK_ID=
YOTI_KEY_FILE_PATH=

# KYC
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=

# Moderation
HIVE_API_KEY=

# Email
RESEND_API_KEY=
```

---

## What NOT to Build

Do not build these. They are explicitly out of scope for MVP.

- "Pay $X for Y hours of chat access" — this is the old model, it is gone
- Task types beyond REPETITION, SUBMISSION, EVIDENCE, CONTENT
- Timed tasks (countdown mechanic) — V1.5
- Pledge/Vow tasks — V1.5
- Recurring tasks (weekly/monthly streak mechanic) — V1.5
- Escalating chain tasks (sequential unlock) — V1.5
- Custom/open freeform tasks — V1.5
- Paid direct messages as a purchasable product
- Push notifications
- In-app dom discovery / feed
- Sub searchability
- Automated payouts
- Multiple crypto assets (USDC on Base only)
- Native iOS/Android app
- AI creator personas
- Dom tier subscriptions

---

## Code Quality Standards

- TypeScript strict mode throughout
- All Supabase queries use the typed client (`Database` type from `src/lib/types/database.ts`)
- Server components for all public pages, client components only where interactivity requires it
- No media ever proxied through Next.js API routes — generate signed Bunny URLs, let browser fetch directly
- `revalidate = 60` on all public SSR pages
- All uploads go through Hive moderation before Bunny storage
- Payment webhook must verify Privy signature before processing

---

## The North Star Metric

**GMV in first 90 days. Target: >£10,000.**

Every product decision should be evaluated against: does this help a sub complete a task and send money to a dom? If not, it can wait.
