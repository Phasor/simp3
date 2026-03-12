'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChatInbox } from './ChatInbox';
import { ChatContainer } from './ChatContainer';
import { useAuth } from '@/lib/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/database';
import type { ConversationServer } from '@/lib/types/chat';

interface ResponsiveChatLayoutProps {
  className?: string;
  initialConversations?: ConversationServer[];
  initialUserId?: string;
}

export function ResponsiveChatLayout({ className = '', initialConversations = [], initialUserId }: ResponsiveChatLayoutProps) {
  const { user, profile: currentProfile, loading: authLoading, resolved: authResolved, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Profile href: doms go to their dashboard, subs to profile
  const profileHref = currentProfile?.user_type === 'CREATOR' ? '/dashboard' : '/profile';

  // --- STATE (no conditional hooks) ---
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [fanProfile, setFanProfile] = useState<Profile | null>(null);

  // Do not read window during render; assume desktop initially
  const [isMobile, setIsMobile] = useState(false);
  const [showInbox, setShowInbox] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const selectedKey = useMemo(
    () => (selectedCreatorId && selectedFanId ? `${selectedCreatorId}|${selectedFanId}` : null),
    [selectedCreatorId, selectedFanId]
  );

  // --- EFFECTS (safe to run on client only) ---

  // Debounced resize: set mobile flag after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rAF: number | null = null;
    const onResize = () => {
      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(() => setIsMobile(window.innerWidth < 768));
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      if (rAF) cancelAnimationFrame(rAF);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    localStorage.removeItem('selectedUserType');
    await signOut(); // navigates to /auth/signout which redirects to /login
  }, [signOut]);

  // Load profiles
  const loadProfiles = useCallback(async (creatorId: string, fanId: string) => {
    try {
      const supabase = createClient();
      const [creatorResult, fanResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', creatorId).single(),
        supabase.from('profiles').select('*').eq('id', fanId).single(),
      ]);
      if (creatorResult.data) setCreatorProfile(creatorResult.data);
      if (fanResult.data) setFanProfile(fanResult.data);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  }, []);

  // Selecting a conversation (guard against loops)
  const handleSelectConversation = useCallback(
    async (creatorId: string, fanId: string, creator?: Profile, fan?: Profile) => {
      const nextKey = `${creatorId}|${fanId}`;
      if (selectedKey === nextKey) return;

      setSelectedCreatorId(creatorId);
      setSelectedFanId(fanId);

      if (creator && fan) {
        setCreatorProfile(creator);
        setFanProfile(fan);
      } else {
        await loadProfiles(creatorId, fanId);
      }

      const currentCreator = searchParams.get('creator');
      const currentFan = searchParams.get('fan');
      if (currentCreator !== creatorId || currentFan !== fanId) {
        router.replace(`/chat?creator=${creatorId}&fan=${fanId}`);
      }

      if (isMobile) setShowInbox(false);
    },
    [isMobile, router, searchParams, selectedKey, loadProfiles]
  );

  // Read URL params; only act on genuine change
  useEffect(() => {
    const urlCreator = searchParams.get('creator');
    const urlFan = searchParams.get('fan');
    const welcome = searchParams.get('welcome');
    const newAccess = searchParams.get('newAccess');

    const urlKey = urlCreator && urlFan ? `${urlCreator}|${urlFan}` : null;

    if (urlKey && urlKey !== selectedKey) {
      handleSelectConversation(urlCreator!, urlFan!);

      // If coming from a fresh purchase, clean up the URL without disrupting state
      if (newAccess === 'true') {
        router.replace(`/chat?creator=${urlCreator}&fan=${urlFan}`);
      }
    } else if (
      urlCreator &&
      currentProfile?.user_type === 'FAN' &&
      (!selectedKey || !selectedKey.startsWith(`${urlCreator}|`))
    ) {
      handleSelectConversation(urlCreator, currentProfile.id);
    }

  }, [searchParams, currentProfile?.user_type, currentProfile?.id, selectedKey, handleSelectConversation, router]);

  const handleBackToInbox = () => {
    setSelectedCreatorId(null);
    setSelectedFanId(null);
    setCreatorProfile(null);
    setFanProfile(null);
    setShowInbox(true);
    router.push('/chat');
  };

  const selectedConversationId =
    selectedCreatorId && selectedFanId ? `${selectedCreatorId}|${selectedFanId}` : undefined;

  // Auth hasn't resolved yet — wait before rendering anything
  if (!authResolved) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your chat…</p>
        </div>
      </div>
    );
  }

  // Auth resolved but no user — show sign-in prompt
  if (!user) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access chat</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ----- Render -----
  if (isMobile) {
    return (
      <>
        <div className={`flex flex-col h-full ${className}`}>
          {showInbox ? (
            <ChatInbox 
              selectedConversationId={selectedConversationId} 
              onSelectConversation={handleSelectConversation}
              initialConversations={initialConversations}
              initialUserId={initialUserId}
            />
          ) : (
            <ChatContainer
              creatorId={selectedCreatorId || undefined}
              fanId={selectedFanId || undefined}
              creatorProfile={creatorProfile || undefined}
              fanProfile={fanProfile || undefined}
              currentProfileId={initialUserId}
              onBack={handleBackToInbox}
            />
          )}
        </div>

      </>
    );
  }

  return (
    <>
      <div className={`h-screen w-screen flex ${className}`}>
        <aside className="w-80 min-w-72 border-r bg-white flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChatInbox 
              selectedConversationId={selectedConversationId} 
              onSelectConversation={handleSelectConversation}
              initialConversations={initialConversations}
              initialUserId={initialUserId}
            />
          </div>

          <div className="border-t p-2">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={profileHref}
                prefetch={false}
                className="flex items-center justify-center rounded-lg border px-2 py-2 hover:bg-gray-50"
              >
                <span className="typ-body-sm text-gray-700">
                  {currentProfile?.user_type === 'CREATOR' ? 'Dashboard' : 'Profile'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center justify-center rounded-lg border px-2 py-2 hover:bg-gray-50 text-rose-600"
              >
                <span className="typ-body-sm text-rose-600">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <ChatContainer
            creatorId={selectedCreatorId || undefined}
            fanId={selectedFanId || undefined}
            creatorProfile={creatorProfile || undefined}
            fanProfile={fanProfile || undefined}
            currentProfileId={initialUserId}
          />
        </main>
      </div>
    </>
  );
}