# Chat Feature Audit Report

**Date:** 2026-03-26
**Branch:** `claude/audit-chat-delivery-TgEpR`
**Issue:** Messages from Doms are sometimes not delivered to Subs

---

## Executive Summary

After a thorough audit of the chat system (API routes, components, realtime hooks, database schema, RLS policies, and views), **7 bugs were identified that can cause Dom messages to fail to deliver.** The root causes span three layers: a client-side conversation ID format mismatch that causes realtime channel reconnection storms, an asymmetric use of Supabase clients (admin vs user-session) between the send and fetch APIs that makes message delivery depend on session freshness, and a UI access-check that blocks Doms from sending when a fan's VIP access expires.

---

## CRITICAL Issues

### BUG 1: Conversation ID Format Mismatch Causes Realtime Channel Reconnection

**Severity:** CRITICAL
**Files:** `src/components/chat/ChatThread.tsx:121,203` + `src/lib/utils/conversationUtils.ts:15` + `src/lib/hooks/useRealtimeChat.ts:152`

**The Bug:**
Three different formats are used for conversation IDs across the codebase:

| Location | Format | Example |
|---|---|---|
| `generateConversationId()` | `sorted_id1_sorted_id2` (underscore, sorted) | `aaa_bbb` |
| `ChatThread.onNewMessage` (line 121) | `creator_id\|fan_id` (pipe, unsorted) | `bbb\|aaa` |
| `ChatThread.useEffect` (line 203) | `creator_id\|fan_id` (pipe, unsorted) | `bbb\|aaa` |

**How it causes non-delivery:**

1. Component mounts → `conversationId` = null
2. `useEffect` (line 210) fires → sets `conversationId` = `generateConversationId(creatorId, fanId)` = `"aaa_bbb"` (sorted, underscore)
3. `useRealtimeChat` subscribes to channel `chat_aaa_bbb`
4. First message arrives → `onNewMessage` callback (line 121) sets `conversationId` = `"bbb|aaa"` (pipe, unsorted)
5. Since `conversationId` is in useRealtimeChat's dependency array (line 300), the effect **tears down the old channel and creates a new one** named `chat_bbb|aaa`
6. **During this teardown/reconnect window, messages are silently dropped**

This happens on EVERY first message in a conversation, creating a ~500ms-2s window where the subscriber has no active channel.

**Fix:**
Standardize on a single format. Remove the `setConversationId` call from `onNewMessage` (line 121-123) since the useEffect on line 210 already sets it correctly. Also fix line 203 to use `generateConversationId()`:

```typescript
// ChatThread.tsx line 200-207 — fix to use consistent format
useEffect(() => {
  if (!conversationId && messages.length > 0) {
    const firstMessage = messages[0];
    if (firstMessage) {
      setConversationId(generateConversationId(firstMessage.creator_id, firstMessage.fan_id));
    }
  }
}, [messages, conversationId]);
```

And in `onNewMessage` (line 119-135), remove the conversationId setter entirely:
```typescript
onNewMessage: useCallback((newMessage: ChatMessage) => {
  // REMOVED: setConversationId — let the useEffect handle it consistently
  setMessages(prev => {
    if (prev.some(msg => msg.id === newMessage.id)) return prev;
    // ... rest of message handling
  });
}, []), // no conversationId dependency needed
```

---

### BUG 2: Fetch API Uses User Session (RLS) While Send API Uses Admin Client

**Severity:** CRITICAL
**Files:** `src/app/api/chat/send/route.ts:77-80` vs `src/app/api/chat/messages/[creatorId]/[fanId]/route.ts:30-31`

**The Bug:**
The send endpoint uses a service-role admin client that bypasses RLS:
```typescript
// send/route.ts:77 — ADMIN client, bypasses RLS
const admin = createClient(url, SUPABASE_SERVICE_ROLE_KEY);
```

But the messages fetch endpoint uses the user's session client subject to RLS:
```typescript
// messages/route.ts:30 — USER client, subject to RLS
const supabase = await createClient();
```

**How it causes non-delivery:**
The `chat_messages` SELECT policy uses `current_profile_id()`, which runs:
```sql
SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
```

If the Dom's JWT is stale or being refreshed, `auth.uid()` returns null → `current_profile_id()` returns null → RLS blocks all rows → the Dom sees **zero messages** even though the send succeeded.

This is particularly common after:
- Tab backgrounded for extended periods (JWT expires)
- Network reconnection events
- Page reload during auth token refresh

**Fix:**
Use the admin client for the fetch API too (with server-side authorization), matching the send API pattern:

```typescript
// messages/route.ts — use admin client after verifying auth
const admin = createClient(url, SUPABASE_SERVICE_ROLE_KEY);
// ... verify user is participant (already done) ...
const { data: messages } = await admin
  .from('chat_messages')
  .select('*')
  .eq('creator_id', creatorId)
  .eq('fan_id', fanId)
  // ...
```

---

### BUG 3: Realtime `postgres_changes` Fails Silently When RLS Uses Custom Functions

**Severity:** CRITICAL
**Files:** `src/lib/hooks/useRealtimeChat.ts:176-223` + `docs/database-setup.sql:342-347`

**The Bug:**
The realtime subscription uses `postgres_changes` on `chat_messages` with NO column filters:
```typescript
newChannel.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'chat_messages',
  // NO filter — relies on RLS
}, (payload) => { ... });
```

The code comments explain: "Adding a column filter causes CHANNEL_ERROR because Supabase Realtime can't validate filters against custom-function RLS policies (current_profile_id())."

However, **Supabase Realtime postgres_changes uses the WAL (Write-Ahead Log)**, and for RLS-based filtering, it evaluates the policy using the subscriber's JWT. The `current_profile_id()` function requires a valid `auth.uid()` from the JWT. **If the JWT expires while the WebSocket is still open, the RLS evaluation silently fails and events stop being delivered** — with no error emitted to the client.

**How it causes non-delivery:**
The subscriber's JWT is set at WebSocket connection time. Supabase client-side libraries auto-refresh the JWT for HTTP requests, but the **Realtime WebSocket does not automatically re-authenticate** when the JWT is refreshed. After ~1 hour (default JWT expiry), the subscriber's `auth.uid()` in the Realtime context becomes stale → `current_profile_id()` may fail → events silently stop flowing.

**Fix:**
Add a periodic message poll as a safety net alongside realtime. This catches any messages missed during JWT transitions, channel errors, or network blips:

```typescript
// In ChatThread — add periodic backfill poll
useEffect(() => {
  if (!creatorId || !fanId) return;
  const interval = setInterval(async () => {
    try {
      const response = await fetchMessages(creatorId, fanId, { limit: 10 });
      setMessages(prev => {
        const newMsgs = response.messages.filter(m => !prev.some(p => p.id === m.id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    } catch {}
  }, 15000); // Poll every 15s as safety net
  return () => clearInterval(interval);
}, [creatorId, fanId]);
```

---

## HIGH Issues

### BUG 4: Dom Cannot Reply When Fan's VIP Access Expires

**Severity:** HIGH
**Files:** `src/components/chat/ChatThread.tsx:249-250,290`

**The Bug:**
The `handleSendMessage` function guards on access status:
```typescript
const handleSendMessage = useCallback(async (content: string) => {
    if (!currentProfileId || !accessStatus?.hasAccess) return; // ← blocks Dom
```

And the MessageInput disabled state:
```typescript
const canSendMessages = accessStatus?.hasAccess && !accessLoading && authReady;
```

The `accessStatus` checks the `chat_access` table for the fan's access to the creator. When the fan's VIP access expires, `hasAccess` = false → **the Dom's MessageInput is disabled and they cannot reply**.

Note: The RLS policy **explicitly allows** Doms to always insert messages:
```sql
CREATE POLICY "messages_insert_with_access" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = current_profile_id()
    AND (
      creator_id = current_profile_id()  -- ← Dom can ALWAYS send
      OR (fan_id = current_profile_id() AND EXISTS (...))
    )
  );
```

**Fix:**
Allow Doms to always send, matching the DB-level permission:
```typescript
const isCreator = currentProfile?.user_type === 'CREATOR';
const canSendMessages = (isCreator || accessStatus?.hasAccess) && !accessLoading && authReady;
```

And in handleSendMessage:
```typescript
if (!currentProfileId || (!isCreator && !accessStatus?.hasAccess)) return;
```

---

### BUG 5: Only Fans Can Start Conversations — Doms Can't Initiate

**Severity:** HIGH
**File:** `src/app/api/chat/start/route.ts:31`

**The Bug:**
```typescript
if (profile.user_type !== 'FAN')
  return NextResponse.json({ error: 'Only subs can start conversations' }, { status: 403 });
```

A Dom cannot start a conversation with a fan who has VIP access. The Dom must wait for the fan to message first. If the fan never initiates, the Dom can never reach them despite the fan having VIP access.

**Fix:**
Allow Doms to start conversations with fans who have active access:
```typescript
if (profile.user_type === 'CREATOR') {
  // Dom starting conversation — verify the fan has access to this dom
  const { data: access } = await admin
    .from('chat_access')
    .select('id')
    .eq('fan_id', domId) // In this case, domId is the fan's ID
    .eq('creator_id', profile.id)
    .eq('state', 'granted')
    .gt('access_until', new Date().toISOString())
    .maybeSingle();
  if (!access) return NextResponse.json({ error: 'Fan does not have VIP access' }, { status: 403 });
  // Swap: creator is the logged-in dom, fan is the target
  conversation = await upsertConversation(admin, profile.id, domId);
} else {
  // Existing fan flow...
}
```

---

### BUG 6: No Backfill Polling After Reconnection Misses

**Severity:** HIGH
**Files:** `src/components/chat/ChatThread.tsx:136-153`

**The Bug:**
The `onConnectionChange` callback only backfills when `messages.length === 0`:
```typescript
onConnectionChange: useCallback((isConnected: boolean) => {
  if (isConnected && messages.length === 0) { // ← only if NO messages loaded
    fetchMessages(creatorId, fanId, { limit: 20 }).then(...)
  }
}, [creatorId, fanId, messages.length]),
```

When a reconnection happens (e.g., after BUG 1's channel swap or network blip), if there are already messages loaded, the backfill is skipped. **Messages sent during the disconnection window are permanently lost** until the user refreshes the page.

**Fix:**
Always backfill on reconnection, deduplicating against existing messages:
```typescript
onConnectionChange: useCallback((isConnected: boolean) => {
  if (isConnected) {
    fetchMessages(creatorId, fanId, { limit: 20 }).then(response => {
      if (response.messages.length > 0) {
        setMessages(prev => {
          const newMessages = response.messages.filter(
            m => !prev.some(p => p.id === m.id)
          );
          if (newMessages.length === 0) return prev;
          return [...prev, ...newMessages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }
    }).catch(err => console.error('Failed to backfill messages:', err));
  }
}, [creatorId, fanId]),
```

---

## MEDIUM Issues

### BUG 7: Session Method Inconsistency — `getSession()` vs `getUser()`

**Severity:** MEDIUM
**Files:** `src/app/api/chat/send/route.ts:70-71` vs `src/app/api/chat/messages/[creatorId]/[fanId]/route.ts:31`

**The Bug:**
- Send API uses `getSession()` — reads JWT from cookie locally, no network call, **can be stale**
- Messages API uses `getUser()` — validates JWT with Supabase server, always fresh

Per [Supabase docs](https://supabase.com/docs/reference/javascript/auth-getuser): "getSession() reads the session from the local cookie and doesn't validate it. getUser() validates the session by making a network request."

If a Dom's session cookie contains an expired JWT:
- `getSession()` succeeds (returns the stale session)
- The admin client insert works (bypasses RLS)
- But the fan's realtime event might not trigger properly if the server-side auth context is stale

**Fix:**
Use `getUser()` consistently in both APIs for authentication, then use admin client for DB operations.

---

## Architecture Notes

### What's Working Correctly

1. **RLS policies on `chat_messages`** — properly allow both creator and fan to read; creator can always insert; fan can insert with active access
2. **RLS on `conversations`** — both parties can read/insert/update
3. **The `sync_conversation_on_message()` trigger** — correctly upserts conversation metadata on each message insert
4. **The `conversations_inbox` view** — efficient single-query inbox with pre-computed access status
5. **Realtime publication** — `chat_messages`, `conversations`, and `chat_access` are all in `supabase_realtime` publication
6. **Optimistic updates** — correctly handled with deduplication in ChatThread

### Schema Not in Migrations

The `chat_messages`, `conversations`, `chat_access`, and `chat_rules` tables are NOT defined in `/supabase/migrations/`. They're in `docs/database-setup.sql`, which must be applied manually. The migration files only ALTER these tables (e.g., adding `tier` column to `chat_access`). This means:
- Schema changes aren't version-controlled through the standard migration system
- There's risk of drift between environments
- **Recommendation:** Create a migration file that captures the current schema as the source of truth

---

## Impact Assessment

| Bug | Frequency | Impact | Who's Affected |
|-----|-----------|--------|----------------|
| BUG 1: ConvID mismatch | Every first message | ~1-2s message blackout | Both parties |
| BUG 2: Admin vs user client | When JWT stale | Dom sees 0 messages | Dom |
| BUG 3: Realtime JWT expiry | After ~1hr idle | Silent event loss | Both parties |
| BUG 4: Access gates Dom send | When fan access expires | Dom can't reply | Dom |
| BUG 5: Dom can't start chat | Always | Dom can't initiate | Dom |
| BUG 6: No reconnect backfill | On every reconnect | Missed messages | Both parties |
| BUG 7: getSession stale | Intermittent | Auth inconsistency | Dom |

---

## Recommended Fix Priority

1. **BUG 1** (ConvID mismatch) — Quick fix, eliminates the most common delivery failure
2. **BUG 6** (Reconnect backfill) — One-line change, catches all transient failures
3. **BUG 2** (Admin client for fetch) — Eliminates RLS-related fetch failures for Doms
4. **BUG 4** (Dom send gating) — Allows Doms to always reply
5. **BUG 3** (Polling safety net) — Catches all edge cases that realtime misses
6. **BUG 5** (Dom initiate chat) — Feature gap, lower urgency
7. **BUG 7** (Session consistency) — Defense in depth
