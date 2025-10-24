# Chat Navigation Freeze - Debug Instrumentation

## Problem
After clicking the Chat button in the navbar, the page shows "Loading your chat…" forever with:
- No console logs
- No network requests
- No errors

This indicates the component tree is stuck in a loading/suspended state.

## Root Cause Analysis

The issue was likely caused by:

1. **Missing SSR Session Hydration**: The `layout.tsx` only passed `initialSession` when `FLAGS.SERVER_AUTH_GATE === true`. On client-side navigation, if this flag was false or the session wasn't passed, the AuthContext would start with `loading: true` and `resolved: false`, requiring a client-side auth check.

2. **Auth Never Resolving**: If the client-side `supabase.auth.getSession()` call stalled or took too long, the auth state would never flip to `resolved: true`, causing all downstream components to wait indefinitely.

3. **Cache Not Hydrating**: The ChatInbox cache hydration had overly strict guards (`authResolved` check) that prevented showing cached conversations during the loading state.

## Fixes Applied

### 1. ClientProbe Component (`src/app/chat/ClientProbe.tsx`)
Created a diagnostic component that logs auth state changes in real-time:
- Logs when component mounts/unmounts
- Logs every change to `user`, `profile`, `loading`, and `resolved`
- Added to `/chat` page to monitor the auth state machine

### 2. AuthContext Logging (`src/lib/contexts/AuthContext.tsx`)
Added comprehensive logging:
- **Mount logging**: Shows when AuthProvider mounts with initial state
- **State change logging**: Logs every state update with all key values
- **Watchdog timer**: Forces `resolved: true` after 2 seconds if auth is still stuck
  - Prevents infinite loading without masking real errors
  - Logs a warning when triggered so you know something went wrong

### 3. Layout Session Hydration (`src/app/layout.tsx`)
Changed from conditional to always-on:
- **Before**: Only fetched session when `FLAGS.SERVER_AUTH_GATE === true`
- **After**: Always fetches session from server for better hydration
- Added logging to see if session is available on SSR

### 4. ChatInbox Cache Optimization (`src/components/chat/ChatInbox.tsx`)
Improved sessionStorage hydration:
- **Relaxed guards**: Removed `authResolved` requirement for cache hydration
- **Smart reload**: Only blocks cache if we already have loaded data for this user
- **Better error handling**: Logs cache hydration failures instead of silent catch

## How to Use

### Step 1: Check Console Logs
After clicking Chat, you should now see:

```
[Layout] SSR session: { hasSession: true, userId: '...', serverAuthGate: ... }
[AuthProvider] mounted instance xxx { hasInitial: true, loading: false, resolved: true }
[AuthProvider] state change { hasUser: true, profileId: '...', loading: false, resolved: true, instanceId: 'xxx' }
[Probe] mounted
[Probe] auth state { hasUser: true, profileId: '...', loading: false, resolved: true }
🧊 Hydrating inbox from cache: 5
```

### Step 2: Watch for Issues

**If you see the watchdog warning:**
```
[AuthProvider] ⚠️ Watchdog forcing resolved after 2s timeout
```
This means `supabase.auth.getSession()` is taking too long or hanging. Possible causes:
- Network issues
- Supabase client misconfiguration
- Cookie access problems in production

**If profile is null but user exists:**
```
[Probe] auth state { hasUser: true, profileId: undefined, loading: false, resolved: true }
```
This means the user is authenticated but their profile isn't in the database or the SELECT failed.

**If resolved stays false forever:**
```
[Probe] auth state { hasUser: false, profileId: undefined, loading: true, resolved: false }
```
(And no watchdog warning after 2 seconds)
This would indicate the watchdog isn't working, which shouldn't happen.

### Step 3: Test Different Navigation Methods

1. **Direct navigation** (type `/chat` in URL or middle-click): Tests full page load with SSR
2. **Client navigation** (click Chat link): Tests client-side transition
3. **After sign out/in**: Tests auth state cleanup

### Step 4: Check Network Tab

With this instrumentation:
- If auth resolves but no network requests fire → ChatInbox isn't mounting or its effects aren't running
- If you see requests but they're stuck → backend issue
- If you see cache logs but no requests → cache is working, real load might be blocked

## Debugging Tips

### Enable DEBUG mode
Set `NEXT_PUBLIC_DEBUG=1` in your `.env.local` to enable verbose logging throughout the app.

### Check sessionStorage
Open DevTools → Application → Storage → Session Storage → Check for `chat:inbox:conversations-cache`

### Force a Fresh State
Clear sessionStorage and cookies, then test:
```javascript
sessionStorage.clear();
```

### Isolate the Issue
If the watchdog fires consistently:
1. Check if `initialSession` is being passed (should be in Layout log)
2. Check if `supabase.auth.getSession()` works in console:
   ```javascript
   const { createClient } = await import('@/lib/supabase/client');
   const supabase = createClient();
   const { data } = await supabase.auth.getSession();
   console.log(data);
   ```

## What to Report
If the issue persists after these changes, provide:

1. **Console output** from clicking Chat until it stalls (with timestamps)
2. **Whether middle-click works** vs client nav
3. **First 10 lines of console** showing Layout and AuthProvider logs
4. **Whether the watchdog fires** (the ⚠️ warning)
5. **Network tab** showing if any requests were made

## Expected Behavior After Fix

1. Click Chat → immediately see cached conversations (if available)
2. Auth state logs show quick resolution (< 500ms)
3. Fresh data loads in background
4. No infinite spinners
5. All logs are clear and traceable

---

**Files Modified:**
- ✅ `src/app/chat/ClientProbe.tsx` (new)
- ✅ `src/app/chat/page.tsx`
- ✅ `src/lib/contexts/AuthContext.tsx`
- ✅ `src/app/layout.tsx`
- ✅ `src/components/chat/ChatInbox.tsx`

