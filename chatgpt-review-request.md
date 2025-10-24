# Chat Inbox Loading Issue - Code Review Request

## Issue Summary

We have a Next.js 15 chat inbox component that loads conversations from Supabase. It was experiencing multiple issues:

1. **Initial Problem**: Forever loading spinner on client-side navigation to `/chat` (hard refresh worked fine)
2. **Root Cause Discovery**: The `conversations` table uses `profile.id` (UUID primary key), but we were querying with `auth_user_id` 
3. **Current Issue**: After fixing the ID mismatch, we now have a race condition where conversations load but show with incorrect access status (all expired) on client navigation, but correct on hard refresh

## Architecture

- **Next.js 15** with App Router
- **Server Component** (`/app/chat/page.tsx`) - SSR fetches conversations and passes to client
- **Client Component** (`ChatInbox.tsx`) - Displays conversations with real-time updates
- **Auth Context** - Provides `user` (auth user), `profile` (database profile), and auth state
- **Database Schema**:
  - `profiles` table: `id` (PK), `auth_user_id` (FK to auth.users)
  - `conversations` table: `creator_id`, `fan_id` (both FK to `profiles.id`, NOT `auth_user_id`)
  - `chat_access` table: tracks access status per creator-fan pair

## Current Code

### Server Component (page.tsx)

```typescript
export default async function ChatPage() {
  const supabase = createServerClient(/* ... */);
  
  // Verify user on the server
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/chat');

  // Get user's profile to use profile ID for conversation queries
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!userProfile) redirect('/profile');

  // SSR-fetch conversations (use profile ID!)
  let initialConversations: ConversationServer[] = [];
  const profileId = userProfile.id;
  
  try {
    const { data } = await supabase
      .from('conversations')
      .select(`*,
        creator:profiles!conversations_creator_id_fkey(*),
        fan:profiles!conversations_fan_id_fkey(*)
      `)
      .or(`creator_id.eq.${profileId},fan_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(50);
    initialConversations = data ?? [];
  } catch (error) {
    console.error('Error fetching initial conversations:', error);
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <ChatApp initialConversations={initialConversations} initialUserId={user.id} />
    </div>
  );
}
```

### Client Component (ChatInbox.tsx) - Key Parts

```typescript
const INBOX_CACHE_KEY = 'chat:inbox:conversations-cache';

export function ChatInbox({
  initialConversations = [],
  initialUserId,
}: ChatInboxProps) {
  const { user, profile: currentProfile, loading: authLoading, resolved: authResolved, supabase } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  
  const loadingRef = useRef(false);
  const mountedRef = useRef(false);
  const lastUserRef = useRef<string | null>(null);

  // 1) Seed from SSR props
  useEffect(() => {
    if (!authResolved || !currentProfile?.id) return;

    const sameUser = lastUserRef.current === currentProfile.id;
    if (!sameUser) {
      lastUserRef.current = currentProfile.id;
      setConversations([]);
      setIsReady(false);
      loadingRef.current = false;
    }

    // Seed from SSR props if they match
    if (initialConversations.length && initialUserId === user?.id && conversations.length === 0) {
      const items = initialConversations.map(toConversationItem);
      
      // Check if SSR seed has access status - if not, skip seed
      const hasAccessData = items.some(item => item.accessStatus !== undefined);
      
      if (hasAccessData) {
        sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify({ userId: currentProfile.id, items }));
        setConversations(items);
        setIsReady(true);
      } else {
        // Skip seed - SSR data doesn't have access status
      }
    }
  }, [authResolved, currentProfile?.id]);

  // 2) Hydrate from sessionStorage cache
  useEffect(() => {
    if (!authResolved || !currentProfile?.id) return;
    if (conversations.length > 0) return;
    
    try {
      const raw = sessionStorage.getItem(INBOX_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached?.userId === currentProfile.id && cached.items?.length) {
        // Only hydrate if cache has access status data
        const hasAccessData = cached.items.some(item => item.accessStatus !== undefined);
        if (hasAccessData) {
          setConversations(cached.items);
          setIsReady(true);
        }
      }
    } catch {}
  }, [authResolved, currentProfile?.id, conversations.length]);

  // 3) Fetch live data
  const loadConversations = useCallback(async () => {
    if (!authResolved || !currentProfile?.id || !user?.id) return;
    if (loadingRef.current) return;
    
    loadingRef.current = true;

    try {
      // Fetch conversations using PROFILE ID
      const base = await supabase
        .from('conversations')
        .select(`*,
          creator:profiles!conversations_creator_id_fkey(*),
          fan:profiles!conversations_fan_id_fkey(*)
        `)
        .or(`creator_id.eq.${currentProfile.id},fan_id.eq.${currentProfile.id}`)
        .order('created_at', { ascending: false });

      if (base.error) throw base.error;

      const rows = base.data ?? [];
      if (!mountedRef.current) return;

      // Fetch access status
      const accessRes = await getUserChatAccess(supabase, currentProfile.id, currentProfile.user_type);
      const accessMap = new Map(accessRes.data?.map(a => [`${a.creator_id}|${a.fan_id}`, a]) ?? []);

      const items: ConversationItem[] = rows.map((conv) => {
        const item = toConversationItem(conv);
        const a = accessMap.get(`${conv.creator_id}|${conv.fan_id}`);
        return {
          ...item,
          accessStatus: a ? calculateAccessStatus(a) : {
            hasAccess: false,
            accessUntil: null,
            isExpired: true,
            // ... other fields
          },
        };
      });

      // Write to cache BEFORE setting state
      sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify({ userId: currentProfile.id, items }));

      if (!mountedRef.current) return;
      setConversations(items);
      setIsReady(true);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e?.message ?? 'Failed to load conversations');
      setIsReady(true); // fail-open
    } finally {
      loadingRef.current = false;
    }
  }, [authResolved, currentProfile?.id, currentProfile?.user_type, supabase, user?.id]);

  // Trigger live load when ready
  useEffect(() => {
    if (!authResolved || !currentProfile?.id || !user?.id) return;
    if (loadingRef.current) return; // Prevent duplicate calls
    
    loadConversations();
  }, [authResolved, currentProfile?.id, user?.id]);

  // Render logic
  const ready = isReady || conversations.length > 0;
  if (!ready) {
    return <div>Loading spinner...</div>;
  }

  return (
    <div>
      {/* Render conversations grouped by access status */}
      {activeConversations.map(...)}
      {expiredConversations.map(...)}
    </div>
  );
}
```

## The Problem

**Symptoms:**
- Hard refresh: Conversations load correctly with proper active/expired status ✅
- Client navigation: Conversations show but ALL appear as "expired" initially, then become correct after a few seconds ❌

**Why This Happens:**
1. SSR provides conversations but NO access status data
2. We skip the SSR seed (because no access status)
3. Cache also lacks access status (first load)
4. Component shows loading spinner until live fetch completes
5. BUT there's a race condition or the loadingRef gets stuck

## Questions for Review

1. **Is our three-stage loading strategy sound?** (SSR seed → cache hydrate → live fetch)
2. **Should we compute access status on the server** so SSR seed includes it?
3. **Is skipping seed/cache when missing access status the right approach?**
4. **Better pattern for the `loadingRef` to prevent duplicate calls?**
5. **How to handle the "fail-open" render** (show data even if incomplete)?

## Additional Context

- The `getUserChatAccess()` function queries the `chat_access` table and returns access records
- The `calculateAccessStatus()` function computes if access is active based on `access_until` timestamp
- We want instant perceived load time (< 100ms) with stale-while-revalidate pattern
- The app needs to work for both OAuth users (Google) and magic link users

---

**Request:** Can you review this architecture and suggest improvements for handling the timing/race condition issues? Are there better patterns for this stale-while-revalidate + SSR seed approach in Next.js 15?

