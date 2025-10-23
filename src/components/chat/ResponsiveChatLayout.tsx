'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu, X, LayoutDashboard, User, LogOut, Plus } from 'lucide-react';
import Link from 'next/link';
import { ChatInbox } from './ChatInbox';
import { ChatContainer } from './ChatContainer';
import { CreatorWelcomeModal } from './CreatorWelcomeModal';
import { useAuth } from '@/lib/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/database';

interface ResponsiveChatLayoutProps {
  className?: string;
}

export function ResponsiveChatLayout({ className = '' }: ResponsiveChatLayoutProps) {
  const { profile: currentProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stabilize profile href to prevent /creator/undefined prefetch
  const profileHref = currentProfile
    ? (currentProfile.user_type === 'CREATOR'
        ? `/creator/${currentProfile.id}`
        : '/profile')
    : '/profile';

  // --- STATE (no conditional hooks) ---
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [fanProfile, setFanProfile] = useState<Profile | null>(null);

  // Do not read window during render; assume desktop initially
  const [isMobile, setIsMobile] = useState(false);
  const [showInbox, setShowInbox] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    setIsMobileMenuOpen(false);
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [signOut]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

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

    const urlKey = urlCreator && urlFan ? `${urlCreator}|${urlFan}` : null;

    if (urlKey && urlKey !== selectedKey) {
      handleSelectConversation(urlCreator!, urlFan!);
    } else if (
      urlCreator &&
      currentProfile?.user_type === 'FAN' &&
      (!selectedKey || !selectedKey.startsWith(`${urlCreator}|`))
    ) {
      handleSelectConversation(urlCreator, currentProfile.id);
    }

    if (welcome === 'true' && currentProfile?.user_type === 'CREATOR') {
      setShowWelcome(true);
    }
  }, [searchParams, currentProfile?.user_type, currentProfile?.id, selectedKey, handleSelectConversation]);

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

  // Keep the sign-in guard; it doesn't affect hook order because it's after all hooks have been declared
  if (!authLoading && !currentProfile) {
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
        <div className={`h-full ${className} relative`}>
          <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-end">
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-40">
              <nav className="px-6 py-4 space-y-4" onClick={closeMobileMenu}>
                <a href="/" className="flex items-center gap-3 text-sm">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </a>
                <Link
                  href={profileHref}
                  prefetch={false}
                  className="flex items-center gap-3 text-sm"
                  onClick={closeMobileMenu}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <button onClick={handleLogout} disabled={isLoggingOut} className="flex items-center gap-3 text-sm text-rose-600">
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </nav>
            </div>
          )}

          <div className="h-full">
            {showInbox ? (
              <ChatInbox selectedConversationId={selectedConversationId} onSelectConversation={handleSelectConversation} />
            ) : (
              <ChatContainer
                creatorId={selectedCreatorId || undefined}
                fanId={selectedFanId || undefined}
                creatorProfile={creatorProfile || undefined}
                fanProfile={fanProfile || undefined}
                onBack={handleBackToInbox}
              />
            )}
          </div>
        </div>

        {showWelcome && <CreatorWelcomeModal onClose={() => setShowWelcome(false)} />}
      </>
    );
  }

  return (
    <>
      <div className={`h-screen w-screen flex ${className}`}>
        <aside className="w-80 min-w-72 border-r bg-white flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChatInbox selectedConversationId={selectedConversationId} onSelectConversation={handleSelectConversation} />
          </div>

          <div className="border-t p-2">
            <div className="grid grid-cols-3 gap-2">
              <a href="/" className="flex items-center justify-center rounded-lg border px-2 py-2 hover:bg-gray-50">
                <span className="typ-body-sm text-gray-700">Dashboard</span>
              </a>
              <Link
                href={profileHref}
                prefetch={false}
                className="flex items-center justify-center rounded-lg border px-2 py-2 hover:bg-gray-50"
              >
                <span className="typ-body-sm text-gray-700">Profile</span>
              </Link>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center justify-center rounded-lg border px-2 py-2 hover:bg-gray-50 text-rose-600"
              >
                <span className="typ-body-sm text-rose-600">Logout</span>
              </button>
            </div>

            <a href="/chat/new" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 typ-body-sm text-white hover:opacity-90">
              <Plus className="h-4 w-4" />
              New Chat
            </a>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <ChatContainer
            creatorId={selectedCreatorId || undefined}
            fanId={selectedFanId || undefined}
            creatorProfile={creatorProfile || undefined}
            fanProfile={fanProfile || undefined}
          />
        </main>
      </div>

      {showWelcome && <CreatorWelcomeModal onClose={() => setShowWelcome(false)} />}
    </>
  );
}