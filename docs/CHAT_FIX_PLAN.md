# Chat Bug Fix Plan

**10 bugs, 9 phases, 7 source files, 7 test files**

---

## Phase 0: Set Up Test Infrastructure

No test framework exists in this project. Vitest is the best choice (ESM-native, fast, supports TS path aliases).

### Step 0.1: Install dependencies
```
vitest, @testing-library/react, @testing-library/jest-dom,
@vitejs/plugin-react, vite-tsconfig-paths, jsdom
```

### Step 0.2: Create `vitest.config.ts`
- `vite-tsconfig-paths` plugin to resolve `@/*`
- `environment: 'jsdom'`
- `globals: true`
- `setupFiles: ['src/test/setup.ts']`

### Step 0.3: Create `src/test/setup.ts`
- Import `@testing-library/jest-dom/vitest`

### Step 0.4: Create `src/test/mocks.ts` — reusable mock factories
- `mockSupabaseClient()` — chainable `.from().select().eq()` etc.
- `mockProfile(overrides)` — valid Profile with defaults
- `mockChatMessage(overrides)` — valid ChatMessage
- `mockAccessStatus(overrides)` — valid ChatAccessStatus
- `mockAuthContext(overrides)` — mock for `useAuth` hook

### Step 0.5: Add scripts to `package.json`
- `"test": "vitest"`, `"test:run": "vitest run"`

---

## Phase 1: Fix Dom Blackout (BUGs 4 + 8) — HIGHEST PRIORITY

These combine to completely block Dom communication when fan VIP expires.

### Step 1.1: Fix BUG 8 — Realtime subscription torn down for Dom
**File:** `src/lib/hooks/useRealtimeChat.ts`

| Line | Current | Change |
|------|---------|--------|
| ~8 (interface) | — | Add `isCreator?: boolean` to `UseRealtimeChatOptions` |
| ~30 (destructure) | — | Add `isCreator = false` to destructured params |
| 125 | `if (!accessStatus?.hasAccess)` | `if (!accessStatus?.hasAccess && !isCreator)` |
| 89 | `if (!accessStatus?.hasAccess)` | `if (!accessStatus?.hasAccess && !isCreator)` |

### Step 1.2: Fix BUG 4 — Dom can't reply when fan access expires
**File:** `src/components/chat/ChatThread.tsx`

| Line | Current | Change |
|------|---------|--------|
| 112-118 | `useRealtimeChat({ ... })` | Add `isCreator,` to the options object |
| 250 | `if (!currentProfileId \|\| !accessStatus?.hasAccess) return;` | `if (!currentProfileId \|\| (!isCreator && !accessStatus?.hasAccess)) return;` |
| 290 | `const canSendMessages = accessStatus?.hasAccess && ...` | `const canSendMessages = (isCreator \|\| accessStatus?.hasAccess) && ...` |

### Step 1.3: Tests
**File:** `src/lib/hooks/__tests__/useRealtimeChat.test.ts`
1. "should NOT tear down channel when access expires and user is creator"
2. "should tear down channel when access expires and user is fan"
3. "should allow reconnect scheduling when access expires for creator"

**File:** `src/components/chat/__tests__/ChatThread.test.tsx`
1. "creator can send messages when fan access is expired"
2. "fan cannot send messages when access is expired"
3. "handleSendMessage proceeds for creator even without access"

---

## Phase 2: Fix Conversation ID Mismatch (BUG 1) — HIGH PRIORITY

Causes realtime channel reconnection storm on every first message.

### Step 2.1: Fix BUG 1
**File:** `src/components/chat/ChatThread.tsx`

| Line | Current | Change |
|------|---------|--------|
| 121-123 | `setConversationId(\`${newMessage.creator_id}\|${newMessage.fan_id}\`)` | **Remove entirely** — let the useEffect handle it |
| 135 | `}, [conversationId])` | `}, [])` — remove dependency |
| 203 | `\`${firstMessage.creator_id}\|${firstMessage.fan_id}\`` | `generateConversationId(firstMessage.creator_id, firstMessage.fan_id)` |
| 269 | `\`${result.message.creator_id}\|${result.message.fan_id}\`` | `generateConversationId(result.message.creator_id, result.message.fan_id)` |

### Step 2.2: Tests
**File:** `src/lib/utils/__tests__/conversationUtils.test.ts`
1. "generateConversationId produces sorted underscore format"
2. "generateConversationId is idempotent regardless of argument order"
3. "parseConversationId round-trips"
4. "isSameConversation detects identical conversations"

---

## Phase 3: Fix Reconnect Backfill (BUG 6) — HIGH PRIORITY

Messages missed during disconnection are permanently lost.

### Step 3.1: Fix BUG 6
**File:** `src/components/chat/ChatThread.tsx`

| Line | Current | Change |
|------|---------|--------|
| 137 | `if (isConnected && messages.length === 0)` | `if (isConnected)` |
| 153 | `[creatorId, fanId, messages.length]` | `[creatorId, fanId]` |

### Step 3.2: Tests (in ChatThread tests)
1. "backfills messages on reconnection even when messages already exist"
2. "deduplicates backfilled messages against existing ones"

---

## Phase 4: Fix Fetch API RLS Issue (BUG 2) — HIGH PRIORITY

Dom sees zero messages when JWT is stale.

### Step 4.1: Fix BUG 2
**File:** `src/app/api/chat/messages/[creatorId]/[fanId]/route.ts`

- Keep `getUser()` for authentication (already correct)
- Add admin client creation after auth:
  ```typescript
  import { createClient as createAdminClient } from '@supabase/supabase-js';
  const admin = createAdminClient(url, SUPABASE_SERVICE_ROLE_KEY);
  ```
- Switch profile lookup (line 41) and message query (line 74) from `supabase` to `admin`
- Matches the pattern already used in `send/route.ts`

### Step 4.2: Tests
**File:** `src/app/api/chat/messages/__tests__/route.test.ts`
1. "returns messages using admin client (bypasses RLS)"
2. "returns 401 when getUser fails"
3. "rejects unauthorized users who are not participants"
4. "returns messages in chronological order"

---

## Phase 5: Add Polling Safety Net (BUG 3) — MEDIUM-HIGH PRIORITY

Realtime JWT expiry causes silent event loss after ~1hr.

### Step 5.1: Fix BUG 3
**File:** `src/components/chat/ChatThread.tsx`

Add new useEffect after line 213:
```typescript
// Safety-net poll: catches messages missed during JWT transitions or realtime gaps
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
    } catch { /* Silently ignore — realtime is the primary path */ }
  }, 15000);
  return () => clearInterval(interval);
}, [creatorId, fanId]);
```

### Step 5.2: Tests (in ChatThread tests)
1. "sets up 15s polling interval on mount"
2. "polling merges new messages without duplicates"
3. "polling does not crash when fetchMessages fails"

---

## Phase 6: Fix Silent Message Drop (BUG 9) — MEDIUM PRIORITY

Messages with unknown sender_id are silently filtered out.

### Step 6.1: Fix BUG 9
**File:** `src/components/chat/ChatMessage.tsx`

Add a `fallbackProfile` helper at top of file, then change line 117-118:
```typescript
// Before:
const sender = profiles[message.sender_id];
if (!sender) return groups;

// After:
const sender = profiles[message.sender_id] ?? fallbackProfile(message.sender_id);
```

### Step 6.2: Tests
**File:** `src/components/chat/__tests__/ChatMessage.test.tsx`
1. "renders messages even when sender profile is missing from profiles map"
2. "shows 'Unknown' for missing sender display name"
3. "still groups messages correctly with fallback profile"

---

## Phase 7: Fix Dom Can't Start Chat (BUG 5) — MEDIUM PRIORITY

### Step 7.1: Fix BUG 5
**File:** `src/app/api/chat/start/route.ts`

Replace the `user_type !== 'FAN'` guard (line 31) with branching logic:
- **CREATOR path:** verify the target fan has active `chat_access` to this creator, then upsert conversation with `creator_id = profile.id`, `fan_id = targetId`
- **FAN path:** existing logic unchanged

### Step 7.2: Tests
**File:** `src/app/api/chat/start/__tests__/route.test.ts`
1. "creator can start conversation with fan who has active VIP access"
2. "creator cannot start conversation with fan who has no VIP access"
3. "fan can still start conversation (existing behavior preserved)"
4. "returns existing conversation if one already exists (idempotent)"

---

## Phase 8: Fix Session Consistency (BUG 10) — LOW PRIORITY

### Step 8.1: Fix BUG 10
**File:** `src/app/api/chat/send/route.ts`

| Line | Current | Change |
|------|---------|--------|
| 70-71 | `auth.getSession()` | `auth.getUser()` |
| 73 | `if (!session)` | `if (userError \|\| !user)` |
| 87 | `session.user.id` | `user.id` |

### Step 8.2: Same fix in `src/app/api/chat/start/route.ts` (line 14)

### Step 8.3: Tests
**File:** `src/app/api/chat/send/__tests__/route.test.ts`
1. "uses getUser() for authentication"
2. "returns 401 when getUser fails"
3. "successfully sends message with valid auth"

---

## Execution Summary

| Phase | Bug(s) | Files Changed | Tests Added | Effort |
|-------|--------|---------------|-------------|--------|
| 0 | — | 4 new infra files | — | Setup |
| 1 | 4, 8 | `useRealtimeChat.ts`, `ChatThread.tsx` | 6 tests | Small |
| 2 | 1 | `ChatThread.tsx` | 4 tests | Small |
| 3 | 6 | `ChatThread.tsx` | 2 tests | Tiny |
| 4 | 2 | `messages/route.ts` | 4 tests | Medium |
| 5 | 3 | `ChatThread.tsx` | 3 tests | Small |
| 6 | 9 | `ChatMessage.tsx` | 3 tests | Small |
| 7 | 5 | `chat/start/route.ts` | 4 tests | Medium |
| 8 | 10 | `send/route.ts`, `start/route.ts` | 3 tests | Tiny |

**Total: ~24 code changes across 7 source files + 7 test files with ~29 test cases**

---

## Test Directory Structure
```
src/
  test/
    setup.ts
    mocks.ts
  lib/
    utils/__tests__/
      conversationUtils.test.ts
    hooks/__tests__/
      useRealtimeChat.test.ts
  components/
    chat/__tests__/
      ChatThread.test.tsx
      ChatMessage.test.tsx
  app/
    api/chat/
      send/__tests__/route.test.ts
      messages/__tests__/route.test.ts
      start/__tests__/route.test.ts
```
