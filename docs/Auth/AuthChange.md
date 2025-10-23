# Next.js + Supabase Auth Reliability Rollout Plan

## Context: What We’re Changing & Why

### Problem Today
- Auth is discovered on the **client** (`getSession()` + `onAuthStateChange`).  
- Protected pages (like `/chat`) render before auth is known ➞ inconsistent “please log in” flashes, spinners, and race conditions.  
- Navbar and prefetch sometimes trigger background RSC fetches that compete with client auth state.  
- Chat inbox blocks on secondary requests (e.g., access status) that occasionally hang.

### Goal
- Make auth **deterministic, flicker-free, and fast** by moving the source of truth to the **server** and hydrating the client with the initial session, while keeping the chat UI 100% interactive.

### Core Approach
1. **Server-gate protected routes**: server checks Supabase session, redirects unauthenticated users *before* rendering.  
2. **Seed client state** with `initialSession` in `AuthProvider` ➞ no post-mount "auth discovery."  
3. **Keep one browser Supabase client** + live `onAuthStateChange` subscription.  
4. **Reduce churn**: prevent provider remounts; disable prefetch for auth-gated routes.  
5. **Collapse multi-round trips** (e.g., conversations + access) into **one SQL view** or short timeouts.

### Why This Works
- Server Components handle auth gating + initial data.  
- Client Components stay fully interactive (state, effects, realtime).  
- No flicker, no random “please log in” states, smaller JS, faster paint.

---

## Rollout Plan (Safe, Incremental, Reversible)

Each phase can be a separate PR. Use `NEXT_PUBLIC_SERVER_AUTH_GATE` as a feature flag for full rollback capability.

---

### Phase 0 — Prepare (Branch + Flag)

1. **Create rollout branch**  
   `feat/server-auth-rollout`

2. **Add feature flag** (`lib/flags.ts`)
   ```ts
   export const FLAGS = {
     SERVER_AUTH_GATE: process.env.NEXT_PUBLIC_SERVER_AUTH_GATE === '1',
   };
   ```

3. **Default flag OFF**
   ```env
   NEXT_PUBLIC_SERVER_AUTH_GATE=0
   ```

> Rollback: set flag back to `0` and redeploy.

---

### Phase 1 — AuthProvider Accepts `initialSession` (No Behavior Change)

4. Update `lib/contexts/AuthContext.tsx`:
   - Accept optional prop `initialSession?: Session | null = null`
   - Seed `user` and `session` from it.
   - Keep single `createClient()` via `useMemo`.
   - Subscribe to `onAuthStateChange`.
   - Add a `resolved` flag for initial load completion.

> This does **not** change behavior when the flag is off.

**Test:** login/logout works normally.  
**Rollback:** revert single file.

---

### Phase 2 — Pass `initialSession` from Server (Flag-Guarded)

5. Edit `app/layout.tsx`:
   ```tsx
   import { cookies } from 'next/headers';
   import { createServerClient } from '@supabase/ssr';
   import { FLAGS } from '@/lib/flags';
   import { AuthProvider } from '@/lib/contexts/AuthContext';

   export default async function RootLayout({ children }: { children: React.ReactNode }) {
     let initialSession = null;
     if (FLAGS.SERVER_AUTH_GATE) {
       const supabase = createServerClient({ cookies });
       initialSession = (await supabase.auth.getSession()).data.session ?? null;
     }

     return (
       <html lang="en">
         <body>
           <AuthProvider initialSession={initialSession}>{children}</AuthProvider>
         </body>
       </html>
     );
   }
   ```

**Test (flag=0):** no change.  
**Test (flag=1):** page instantly shows authenticated state, no flicker.

---

### Phase 3 — Convert One Route to Server-Gated (Canary)

6. Pick `/settings` (safe route) and change `app/settings/page.tsx`:
   ```tsx
   import { cookies } from 'next/headers';
   import { redirect } from 'next/navigation';
   import { createServerClient } from '@supabase/ssr';
   import { FLAGS } from '@/lib/flags';
   import SettingsClient from './SettingsClient';

   export default async function Page() {
     if (!FLAGS.SERVER_AUTH_GATE) return <SettingsClient />;

     const supabase = createServerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) redirect('/login?next=/settings');

     const { data: profile } = await supabase
       .from('profiles').select('*').eq('auth_user_id', session.user.id).single();

     return <SettingsClient initialProfile={profile ?? null} />;
   }
   ```

**Test:**
- Unauthed → redirected to `/login?next=/settings`.
- Authed → instant render.

---

### Phase 4 — Harden Provider + Navbar Stability

7. Ensure `AuthProvider` wraps the entire app in `layout.tsx` (above Navbar).  
   Remove any `key={pathname}` or rerender triggers on root layout.

8. Disable prefetch for auth-gated links:
   ```tsx
   <Link href="/chat" prefetch={false}>Chat</Link>
   <Link href="/profile" prefetch={false}>Profile</Link>
   <Link href={`/creator/${profile.id}`} prefetch={false}>Creator</Link>
   ```

9. Stabilize dynamic hrefs:
   ```tsx
   const profileHref = profile
     ? (profile.user_type === 'CREATOR' ? `/creator/${profile.id}` : '/profile')
     : '/profile';
   ```

**Test:** No `/creator/undefined` or background fetches.

---

### Phase 5 — Optimize Chat Query Performance

10. Create/extend Supabase SQL view `conversations_with_last_message`:
   ```sql
   create or replace view conversations_with_last_message as
   select
     c.*,
     creator.id as creator_id_join, creator.email as creator_email,
     creator.display_name as creator_display_name, creator.user_type as creator_user_type, creator.profile_picture_url as creator_ppu,
     fan.id as fan_id_join, fan.email as fan_email,
     fan.display_name as fan_display_name, fan.user_type as fan_user_type, fan.profile_picture_url as fan_ppu,
     lm.id as last_message_id, lm.sender_id as last_message_sender_id, lm.content as last_message_content, lm.created_at as last_message_created_at,
     ca.id as access_id, ca.access_until, ca.created_at as access_created_at
   from conversations c
   join profiles creator on creator.id = c.creator_id
   join profiles fan on fan.id = c.fan_id
   left join lateral (
     select * from chat_messages m
     where m.creator_id = c.creator_id and m.fan_id = c.fan_id
     order by m.created_at desc
     limit 1
   ) lm on true
   left join lateral (
     select * from chat_access a
     where a.creator_id = c.creator_id and a.fan_id = c.fan_id
     order by a.access_until desc nulls last
     limit 1
   ) ca on true;
   ```

11. Update `ChatInbox` to use this view (remove extra fetches or timebox to 3s).

**Test:** Inbox loads instantly; no infinite spinner.

---

### Phase 6 — Convert `/profile` and `/creator/[id]` (Flagged)

12. Apply the same server-gate pattern to `/profile` and `/creator/[id]`.

**Test:** No flicker, correct redirect on unauthenticated access.

---

### Phase 7 — Convert `/chat` (Final Step)

13. Change `app/chat/page.tsx` to a server-gated version:
   ```tsx
   import { cookies } from 'next/headers';
   import { redirect } from 'next/navigation';
   import { createServerClient } from '@supabase/ssr';
   import { FLAGS } from '@/lib/flags';
   import ChatClient from './ChatClient';

   export default async function ChatPage() {
     if (!FLAGS.SERVER_AUTH_GATE) return <ChatClient />;

     const supabase = createServerClient({ cookies });
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) redirect('/login?next=/chat');

     return <ChatClient />;
   }
   ```

**Test:**
- Logged in → loads instantly, no flicker.
- Logged out → redirects to login.

---

## Observability & QA Checklist

- Log `AuthContext` transitions: `{ resolved, hasSession: !!session, hasProfile: !!profile }`.
- Monitor redirect rates and Supabase 401/403 logs.
- QA: cold load `/chat`, `/profile`, `/creator/[id]` → no login flash.
- Private tab `/chat` → redirects to `/login?next=/chat`.
- Navigate between Dashboard → Chat → Profile → back → no remount flicker.
- Realtime chat still works after migration.

---

## Rollback Plan (Any Step)

- Set `NEXT_PUBLIC_SERVER_AUTH_GATE=0` and redeploy.  
- Revert specific route files to client-only versions if needed.  
- Provider updates (Phase 1) are backward-compatible.

---

## Finalize

- Once verified stable: remove feature flag, legacy code, and timeouts.  
- Keep `prefetch={false}` on auth-gated links for performance.

---

**End of Plan**

