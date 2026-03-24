# CLAUDE.md — Tribute

## What is Tribute

Tribute is a findom-native task platform. Doms create tasks, subs pay to perform them, and sustained devotion (spending + task completions) earns VIP chat access — granted monthly based on Tribute Score.

It is NOT a pure content platform. It is NOT pure pay-for-chat. Access is earned through tasks and spending, then granted or revoked monthly.

---

## The Core Loop

```
Dom creates a task → shares direct link to /task/[taskId] on X
  → Sub lands on task detail page
  → Sub sees: task type, price, dom's name + photo
  → Sub creates account (email OTP) → age verified → wallet created
  → Sub pays to accept → Send Moment (ceremonial screen)
  → Sub completes task → submits evidence
  → Dom approves in review inbox
  → Tribute Score updates via Postgres trigger
  → 1st of each month: score recalculated → chat tier assigned
  → VIP: top X% → group channel | VVIP: top N → private DMs
  → Sub notified: tier granted or lost + rank shown if lost
```

---

## Users and Roles

| Display | DB column value | Route prefix |
|---|---|---|
| Dom | `user_type = 'CREATOR'` | `/dashboard` |
| Sub | `user_type = 'FAN'` | `/home`, `/score`, `/chat` |

**Never rename DB column values. UI display strings only.**

---

**Current product features**
- Auth: email OTP via Supabase + Resend. Sub onboarding: age verify (Verifymy → Yoti fallback) + Privy server wallet creation
- Dom onboarding: handle setup + profile builder
- Public dom profile page (`/[domHandle]`) — SSR, `revalidate = 60`
- Task system: 4 types (REPETITION, SUBMISSION, EVIDENCE, CONTENT). Send Moment payment screen. Completion UIs per type. Dom review inbox with approve/reject
- Sub score page (`/score/[subId]`) — public, noindex, shareable credential
- Content wall: upload → Hive moderation → Bunny storage → blurred locked previews → unlock via payment
- VIP chat: group channel (`/chat/vip/[domHandle]`) + private DMs. Access gated by `chat_access` table populated by `recalculate_vip_access()`
- Dom dashboard: Overview, Tasks, Subs leaderboard, Earnings, Settings tabs
- Payments: USDC on Base via Privy server wallets. Privy webhook → `task_completions` + `purchases`. 15% platform fee
- Sub home feed: For You / Following tabs with blurred cover cards
- Follow system: `follows` table, follow button on dom profiles

---

## Stack

- **Framework:** Next.js 15 App Router / React 19 / TypeScript strict
- **DB/Auth:** Supabase (SSR client) — email OTP auth
- **Payments:** Privy server wallets, USDC on Base (Sepolia dev / mainnet prod)
- **CDN:** Bunny.net — token auth enabled, all media via `/api/image/[...path]` proxy
- **Email:** Resend
- **Charts:** Recharts
- **Styling:** Tailwind CSS, dark theme (`bg-black`, `bg-gray-950`, `border-gray-800`)
- **MCP:** Supabase MCP installed — use `mcp__supabase__execute_sql`, `mcp__supabase__list_tables`, `mcp__supabase__apply_migration` etc. for DB work instead of manual SQL files where possible

---

## Key Files

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root: PrivyNoSSR → AuthProvider → NavSwitcher |
| `src/components/PrivyNoSSR.tsx` | dynamic() wrapper — keeps Privy out of server bundle |
| `src/components/NavSwitcher.tsx` | Renders DomDashboardNav (CREATOR) or SubBottomNav (FAN) |
| `src/components/SubBottomNav.tsx` | Mobile: fixed bottom tabs; desktop: sticky top bar + avatar dropdown |
| `src/components/DomDashboardNav.tsx` | Dom top nav with 5 dashboard tabs |
| `src/app/[domHandle]/page.tsx` | SSR dom profile (`revalidate=60`) |
| `src/app/[domHandle]/DomProfileClient.tsx` | Follow button, follower count |
| `src/app/task/[taskId]/page.tsx` | SSR task detail — NO status filter (doms can reach DRAFT tasks) |
| `src/app/task/[taskId]/TaskDetailClient.tsx` | Task sell page (subs) + inline edit mode (dom owner) + payment modal |
| `src/app/task/[taskId]/pay/page.tsx` | Send Moment — zero navigation, full screen |
| `src/app/task/[taskId]/complete/page.tsx` | Task completion UI per type |
| `src/app/dashboard/tasks/page.tsx` | Task builder + review inbox |
| `src/app/home/page.tsx` | Sub feed (For You / Following) |
| `src/app/api/task/accept/route.ts` | Server-side USDC transfer via Privy REST API |
| `src/app/api/task/update/route.ts` | Update task fields + status |
| `src/app/api/task-completion/[completionId]/submit/route.ts` | REPETITION→APPROVED, others→SUBMITTED |
| `src/app/api/task-completion/[completionId]/review/route.ts` | Dom approve/reject |
| `src/app/api/payment/webhook/route.ts` | Privy webhook handler |
| `src/app/api/wallet/create/route.ts` | Creates Privy server wallet |
| `src/app/api/follow/route.ts` | Toggle follow/unfollow (FAN only) |
| `src/app/api/feed/route.ts` | GET ?tab=for-you\|following |
| `src/app/api/vip/recalculate/route.ts` | Trigger VIP access recalculation |
| `src/lib/contexts/AuthContext.tsx` | Auth state |
| `src/lib/supabase/server.ts` | Server client (`getServerSupabase`, `createClient`) |
| `src/lib/utils/bunnynet.ts` | `getBunnyStorageUrl(path)` → `/api/image/...` |
| `supabase/migrations/20260312000000_tribute_phase1.sql` | Full DB schema |
| `supabase/migrations/20260312000001_tribute_phase10.sql` | `privy_wallet_id` on profiles |

---

## Navigation Rules

| Context | Nav shown |
|---|---|
| `/[domHandle]`, `/score/[subId]`, `/login`, `/signup`, `/onboarding` | WordmarkOnly |
| `/task/[taskId]/pay` (Send Moment) | **None — zero navigation** |
| `/task/[taskId]/complete` | Back arrow + task title only |
| Authenticated FAN | SubBottomNav (bottom tabs mobile, sticky top bar desktop) |
| Authenticated CREATOR | DomDashboardNav (top tab bar) |

SubBottomNav tabs: `Home → /home` · `Chat → /chat` · `Score → /score/[id]` · `Profile → /profile`

DomDashboardNav tabs: `Overview → /dashboard` · `Tasks → /dashboard/tasks` · `Subs → /dashboard/subs` · `Earnings → /dashboard/earnings` · `Settings → /dashboard/settings`

---

## DB Tables

**Core (from simp3):** `profiles`, `tasks`, `media_assets`, `purchases`, `chat_access`, `conversations`, `chat_messages`

**Added for Tribute:** `task_completions`, `content_unlocks`, `tribute_scores`, `vip_tiers`, `vip_messages`, `follows`

**Key columns added:**
- `profiles`: `handle`, `wallet_address`, `privy_wallet_id`, `age_verified`, `tribute_alias`, `vip_cta_text`, `tagline`, `kyc_status`
- `tasks`: `task_type`, `status`, `price_usdc`, `instructions`, `repetition_phrase`, `required_repetitions`, `cover_image_url`
- `chat_access`: `tier` (GROUP/PRIVATE), `rank_at_grant`

**Key functions:** `recalculate_tribute_score(fan_id, dom_id)` · `recalculate_vip_access(dom_id)`

**Trigger:** `task_completions` AFTER UPDATE status='APPROVED' → fires `recalculate_tribute_score()`

---

## Task Types

| Type | Sub does | Auto-approve? |
|---|---|---|
| REPETITION | Types a phrase N times (paste disabled) | Yes — on count met |
| SUBMISSION | Writes declaration (paste disabled) | No — dom reviews |
| EVIDENCE | Uploads photo proof | No — dom reviews |
| CONTENT | Payment IS completion | Yes — on payment |

---

## Tribute Score Tiers

Tiers (thresholds hidden from subs to prevent gaming): `UNVERIFIED` → `TRIBUTE_INITIATE` (1–99) → `VERIFIED_PAYER` (100–499) → `DEVOTED` (500–1499) → `DEDICATED` (1500–4999) → `ELITE` (5000+)

Score weights: spend 50% · tasks 30% · tenure 10% · diversity 10%

---

## Payment Architecture

Privy server wallets (not client-side signing):
1. Sub onboarding → `POST /api/wallet/create` → Privy REST → stores `wallet_address` + `privy_wallet_id`
2. Task accept → `POST /api/task/accept` → server calls Privy RPC → creates `task_completions` + `purchases` row
3. Stub fallback: `0xSTUB_...` tx hash if `privy_wallet_id` null or Privy unconfigured
4. Privy webhook → `POST /api/payment/webhook` → verifies sig → on `transaction.confirmed` sends dom email
5. Dom must set `wallet_address` in Settings to receive payments
6. Chain: Base Sepolia (84532) in dev, Base mainnet (8453) in prod (controlled by `NODE_ENV`)

---

## Bunny CDN

Token authentication is **enabled** on the pull zone — direct CDN URLs return 403.

- All media served via Next.js proxy: `/api/image/[...path]`
- DB stores **relative paths** (e.g. `banner-images/foo.jpg`), never full CDN URLs
- `getBunnyStorageUrl(path)` converts relative path → `/api/image/...`
- Always use `getBunnyStorageUrl()` before rendering any media

---

## Dashboard Client Component Pattern

All `/dashboard/*` pages are client components (fetch after mount):
- `const sb = supabase()` MUST be created **inside** `fetchData`, never at component level
- `fetchData(showSpinner = false)` — pass `true` only on initial load, `false` on silent refreshes

---

## Test Accounts

- **Dom:** `phas0ruk+dom@gmail.com` / password auth / handle: `test_dom` / has wallet + banner image
- **Sub:** `phas0ruk+sub@gmail.com` / password auth (no `privy_wallet_id` — uses stub payment path)

Login: `src/app/login/LoginClient.tsx` has a password toggle for test accounts.

---

## Routes

```
Public (SSR, revalidate=60):
  /[domHandle]                  Dom profile
  /score/[subId]                Sub score page (noindex)

Auth:
  /login  /signup  /onboarding

Sub-facing (FAN, auth required):
  /home                         Feed (For You / Following)
  /task/[taskId]                Task detail + accept
  /task/[taskId]/pay            Send Moment (zero nav)
  /task/[taskId]/complete       Completion UI
  /chat                         Chat inbox
  /chat/vip/[domHandle]         VIP group channel
  /score/[subId]                Score page
  /profile                      Sub profile

Dom-facing (CREATOR, auth required):
  /dashboard                    Overview
  /dashboard/tasks              Task builder + review inbox
  /dashboard/subs               Sub leaderboard
  /dashboard/earnings           Earnings + payout
  /dashboard/settings           VIP thresholds + profile

API:
  /api/payment/webhook          Privy webhook
  /api/wallet/create            Privy server wallet creation
  /api/task/accept              USDC transfer + task_completions row
  /api/task/update              Update task fields
  /api/task-completion/[id]/submit   Sub submits completion
  /api/task-completion/[id]/review   Dom approve/reject
  /api/upload                   Hive check → Bunny upload
  /api/image/[...path]          Bunny CDN proxy
  /api/vip/recalculate          Monthly VIP recalc (cron)
  /api/follow                   Follow/unfollow toggle
  /api/feed                     Sub home feed
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_WEBHOOK_SECRET=

BUNNY_STORAGE_ZONE=
BUNNY_STORAGE_PASSWORD=
BUNNY_CDN_URL=
BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
BUNNY_TOKEN_AUTH_KEY=

VERIFYMY_API_KEY=
YOTI_SDK_ID=
YOTI_KEY_FILE_PATH=

SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=

HIVE_API_KEY=

RESEND_API_KEY=
```

---

## Code Quality Standards

- TypeScript strict mode throughout
- All Supabase queries use typed client (`Database` type from `src/lib/types/database.ts`)
- Server components for public pages, client components only where interactivity requires it
- **No media proxied through Next.js** — generate signed Bunny URLs, redirect browser directly
- `revalidate = 60` on all public SSR pages
- All uploads through Hive moderation before Bunny storage
- Payment webhook must verify Privy signature before processing

---

## What NOT to Build (MVP scope)

- Pay-per-hour chat access (old model — gone)
- Task types beyond REPETITION, SUBMISSION, EVIDENCE, CONTENT
- Timed tasks, pledge/vow tasks, recurring streaks, escalating chains, freeform tasks — V1.5
- Push notifications
- In-app sub searchability
- Automated payouts
- Multiple crypto assets (USDC on Base only)
- Native iOS/Android app, AI personas, dom tier subscriptions

---

## North Star Metric

**GMV in first 90 days. Target: >£10,000.**

Every decision: does this help a sub complete a task and send money to a dom? If not, it can wait.
