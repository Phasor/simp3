# Convert `/chat` into a Client “SPA Island” (Next.js App Router)

**Audience:** Claude / another engineer implementing the change  
**Objective:** Make the `/chat` route behave like a single‑page app (SPA) while keeping the rest of the site server‑rendered. This removes auth timing/race issues on client navigation and gives chat a native, real‑time feel without rewriting the whole app.

---

## Why we’re doing this

We’ve seen these problems on client-side navigation to `/chat`:

- Infinite spinner / “taking longer than usual…” with no network activity.
- `AuthContext` races during client transitions (no `initialSession` available, resolves later).
- Prefetching or partial mounts causing overlapping fetches and stuck `loading` flags.

**Hard refresh works** (server injects session), but **client nav breaks** (providers and effects race).

**Solution:** Keep the **App Router** and **SSR** everywhere, but make **`/chat` a client-owned subtree (“SPA island”)**. We server‑gate once at the route boundary and then hand everything to client providers that mount **once** and own their state (auth, query cache, sockets).

---

## High‑Level Plan

1. **Server‑gate the route:** In `src/app/chat/page.tsx`, verify user with `supabase.auth.getUser()` and pass a server-fetched `initialSession` down to the client.
2. **Client-only ChatApp:** Create `src/app/chat/ChatApp.tsx` with `'use client'`. Inside, mount:
   - `AuthProvider` **using the `initialSession` prop**.
   - (Optional) `QueryClientProvider` (TanStack Query) for network caching.
   - (Optional) `Socket/RealtimeProvider` for a single WebSocket connection.
   - Your existing `ResponsiveChatLayout` (and `ChatInbox`, `ChatContainer`).
3. **No server components below `/chat`:** treat `/chat` subtree as pure client. Avoid RSC there.
4. **Disable prefetch to `/chat`** in the global navbar to stop premature mounts during hover.
5. **Keep global RSC/SSR** elsewhere (dashboard, marketing, profile).

This approach is the **least churn** and yields predictable client behavior for chat.

---

## Prereqs

- Next.js 14/15 App Router
- Supabase auth (`@supabase/ssr` + browser client)
- Existing `AuthProvider` already accepts an optional `initialSession` (we have this).
- Node 18+

> **Windows shell commands** below use PowerShell or Command Prompt semantics.

---

## Step 0 — Create a safety branch

```powershell
git checkout -b feature/chat-spa-island
```

---

## Step 1 — Server‑gate `/chat`

Create/replace `src/app/chat/page.tsx` (Server Component). We **verify** with `getUser()` and **hydrate** the client with `initialSession`. Use the **3‑argument** `createServerClient` API w/ cookie adapters (stable in Next 15).

```tsx
// src/app/chat/page.tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import ChatApp from './ChatApp';

export const dynamic = 'force-dynamic'; // user-specific

export default async function ChatPage() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        async get(name: string) { return (await cookieStore).get(name)?.value; },
        async set(name: string, value: string, options?: any) {
          try { (await cookieStore).set(name, value, options); } catch {}
        },
        async remove(name: string, options?: any) {
          try { (await cookieStore).set(name, '', { ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );

  // Verify user on the server (authentic)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Hydrate client with the session for immediate auth
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <ChatApp initialSession={session} />
    </div>
  );
}
```

**Why `getUser()`?** It calls Supabase Auth and returns a verified user (cookie alone can’t be trusted on the server).

---

## Step 2 — Client-only `ChatApp` (SPA island root)

Create `src/app/chat/ChatApp.tsx`. It mounts a **dedicated** `AuthProvider` that consumes the `initialSession` passed by the server. Everything under this stays client‑side and mounts **once** per visit.

```tsx
// src/app/chat/ChatApp.tsx
'use client';

import type { Session } from '@supabase/supabase-js';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { ResponsiveChatLayout } from '@/components/chat/ResponsiveChatLayout';

// Optional: Query client + Realtime/socket providers if you use them
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// const queryClient = new QueryClient();

export default function ChatApp({ initialSession }: { initialSession: Session | null }) {
  return (
    <AuthProvider initialSession={initialSession}>
      {/* <QueryClientProvider client={queryClient}> */}
        <ResponsiveChatLayout />
      {/* </QueryClientProvider> */}
    </AuthProvider>
  );
}
```

> It’s OK if you already have a global `AuthProvider` in `RootLayout`. For the SPA island, we **nest** another `AuthProvider` scoped to `/chat` that uses the server-hydrated session. This avoids timing issues from client navigations that don’t remount the root layout.

---

## Step 3 — Disable prefetch to `/chat` in the navbar

Prevent Next from pre-mounting the route during hover in dev. Update any links to chat:

```tsx
// In your global navbar
import Link from 'next/link';

<Link href="/chat" prefetch={false}>
  Chat
</Link>
```

---

## Step 4 — Keep the `/chat` subtree client-only

- Do **not** import server components under `/chat`.
- Keep existing `ResponsiveChatLayout`, `ChatInbox`, `ChatContainer` as **client**.
- If you need server data, fetch it via Supabase client on the browser or create explicit API routes.

---

## Step 5 — (Important) Make data loaders abort‑safe and single‑exit

The most common stuck‑spinner cause is **early returns that skip cleanup** and queries that **don’t actually abort**.

In Supabase v2, attach abort with `.abortSignal(controller.signal)` on the query builder:

```ts
// Example inside ChatInbox loader
const controller = new AbortController();

const { data, error } = await supabase
  .from('conversations_with_last_message')
  .select('*')
  .or(`creator_id.eq.${profile.id},fan_id.eq.${profile.id}`)
  .order('last_message_at', { ascending: false })
  .abortSignal(controller.signal); // ✅ actual abort

// Ensure cleanup always runs (finish() pattern)
try {
  setLoading(true);
  // ...
} catch (e) {
  if ((e as any).name !== 'AbortError') setError('Failed to load conversations');
} finally {
  finish(); // flips loading=false regardless of path
}
```

If you call helpers like `getUserChatAccess`, add an optional `{ signal }` and chain `.abortSignal(signal)` inside that helper’s Supabase query.

---

## Step 6 — Auth gating pattern inside ChatInbox (client)

Gate on **both** `authLoading` **and** `authResolved` from the `AuthProvider` so client nav equals hard refresh:

```ts
const { profile, loading: authLoading, resolved: authResolved, supabase } = useAuth();

if ((authLoading || !authResolved) && !isAuthLoadingOverride) {
  // wait for the very first resolution
  return finish();
}

if (!profile?.id) {
  setError('You are not signed in.');
  return finish();
}
```

Trigger the first fetch with stable keys:

```ts
useEffect(() => {
  if (authResolved && !authLoading && profile?.id) {
    loadConversations(profile);
  }
}, [authResolved, authLoading, profile?.id]);
```

---

## Step 7 — Optional: Realtime/socket provider (mount once)

If you use a socket, mount it **inside `ChatApp`** so it persists while navigating within `/chat` and is torn down when leaving `/chat`.

```tsx
// Pseudocode
<SocketProvider url={WS_URL}>
  <ResponsiveChatLayout />
</SocketProvider>
```

---

## Step 8 — Testing checklist

- [ ] Hard refresh on `/chat` shows conversations.
- [ ] Click **Chat** from other pages (client nav) → conversations load within the same timeline as refresh.
- [ ] No forever spinner; AbortController cancels on rapid route changes.
- [ ] Try Again button refetches.
- [ ] Profile links don’t prefetch `/chat` and don’t cause partial mounts.
- [ ] Leaving `/chat` closes realtime connections (if any).

---

## Step 9 — Rollout instructions

1. Land the route boundary and `ChatApp` files.
2. Add `prefetch={false}` to `/chat` links.
3. Merge to a canary branch and test **client navigation** repeatedly.
4. If stable, merge to `main`. If regressions:
   - Revert the `/chat` route to previous page component (single file revert).
   - No database or schema changes were required.

---

## Step 10 — Windows dev commands

```powershell
# Install deps (if you add tanstack/react-query, etc.)
npm install

# Run dev server
npm run dev

# Type check
npm run type-check
```

---

## Notes / Common pitfalls

- **Object-form `createServerClient` + env in Next 15** can fail to read envs. Use the **3‑argument** API with cookie adapters (as shown).
- **Don’t pass `{ signal }` to `.select()`**; Supabase’s query builder needs `.abortSignal(signal)`.
- **Single cleanup path** for loaders. Early `return` inside `try` often leaves `loading=true` forever.
- **Don’t rely on `getSession()` on the server** for gating; use `getUser()` for authenticity.
- **Nested AuthProvider** under `/chat` is intentional for SPA isolation; it doesn’t conflict with a global provider.

---

## File diff summary

- **Added** `src/app/chat/page.tsx` (server-gated route)
- **Added** `src/app/chat/ChatApp.tsx` (client SPA root)
- **Updated** navbar links: `<Link href="/chat" prefetch={false}>`
- **(Optional)** Adjusted ChatInbox loader to use `.abortSignal()` + single `finish()` path.

---

## Ready-to-copy snippets

**Navbar link:**
```tsx
<Link href="/chat" prefetch={false}>Chat</Link>
```

**Server route gate:**
```tsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/login');
const { data: { session } } = await supabase.auth.getSession();
return <ChatApp initialSession={session} />;
```

**Client SPA root:**
```tsx
<AuthProvider initialSession={initialSession}>
  <ResponsiveChatLayout />
</AuthProvider>
```

**Supabase abort:**
```ts
supabase.from('conversations').select('*').abortSignal(controller.signal)
```

That’s it—this keeps the rest of the app fast and server-rendered while giving chat the native, predictable feel it needs.
