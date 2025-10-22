'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu, X, LayoutDashboard, User, LogOut, Plus } from 'lucide-react';
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
  
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [fanProfile, setFanProfile] = useState<Profile | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showInbox, setShowInbox] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  // Mobile menu handlers
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Load profiles when conversation is selected
  const loadProfiles = async (creatorId: string, fanId: string) => {
    try {
      const supabase = createClient();
      
      const [creatorResult, fanResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', creatorId).single(),
        supabase.from('profiles').select('*').eq('id', fanId).single()
      ]);

      if (creatorResult.data) setCreatorProfile(creatorResult.data);
      if (fanResult.data) setFanProfile(fanResult.data);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleSelectConversation = useCallback(async (creatorId: string, fanId: string, creator?: Profile, fan?: Profile) => {
    setSelectedCreatorId(creatorId);
    setSelectedFanId(fanId);

    // If profiles are provided, use them
    if (creator && fan) {
      setCreatorProfile(creator);
      setFanProfile(fan);
    } else {
      // Otherwise load them
      await loadProfiles(creatorId, fanId);
    }

    // Update URL
    const params = new URLSearchParams();
    params.set('creator', creatorId);
    params.set('fan', fanId);
    router.push(`/chat?${params.toString()}`);

    // On mobile, hide inbox when conversation is selected
    if (isMobile) {
      setShowInbox(false);
    }
  }, [isMobile, router]); // Remove loadProfiles dependency

  // Read URL parameters on mount
  useEffect(() => {
    const creatorId = searchParams.get('creator');
    const fanId = searchParams.get('fan');
    const welcome = searchParams.get('welcome');
    
    if (creatorId && fanId) {
      handleSelectConversation(creatorId, fanId);
    }
    
    // Show welcome modal for new creators
    if (welcome === 'true' && currentProfile?.user_type === 'CREATOR') {
      setShowWelcome(true);
    }
  }, [searchParams, currentProfile?.user_type]); // Remove handleSelectConversation dependency

  const handleBackToInbox = () => {
    setSelectedCreatorId(null);
    setSelectedFanId(null);
    setCreatorProfile(null);
    setFanProfile(null);
    setShowInbox(true);
    
    
    // Clear URL parameters
    router.push('/chat');
  };

  const selectedConversationId = selectedCreatorId && selectedFanId 
    ? `${selectedCreatorId}|${selectedFanId}` 
    : undefined;

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentProfile) {
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

  if (isMobile) {
    // Mobile: Show either inbox or conversation, not both
    return (
      <>
        <div className={`h-full ${className} relative`}>
          {/* Mobile Header with Hamburger Menu */}
          <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-end">
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-40">
              <nav className="px-6 py-4 space-y-4">
                <a href="/" className="flex items-center gap-3 text-sm">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </a>
                
                <a href={currentProfile?.user_type === 'CREATOR' ? `/creator/${currentProfile.id}` : '/profile'} className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4" />
                  Profile
                </a>
                
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center gap-3 text-sm text-rose-600"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </nav>
            </div>
          )}

          {/* Main Content */}
          <div className="h-full">
            {showInbox ? (
              <ChatInbox
                selectedConversationId={selectedConversationId}
                onSelectConversation={handleSelectConversation}
              />
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

        {/* Welcome modal for new creators */}
        {showWelcome && (
          <CreatorWelcomeModal onClose={() => setShowWelcome(false)} />
        )}
      </>
    );
  }

  // Desktop: Show both inbox and conversation side by side with new design
  return (
    <>
      <div className={`h-screen w-screen flex ${className}`}>
        {/* SIDEBAR */}
        <aside className="w-72 min-w-64 border-r bg-white flex flex-col">
          {/* Inbox with search and conversations */}
          <div className="flex-1 overflow-hidden">
            <ChatInbox
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
            />
          </div>

          {/* Bottom Mini-Nav */}
          <div className="border-t p-2">
            <div className="grid grid-cols-3 gap-2">
              <a href="/" className="flex items-center gap-2 rounded-lg border px-2 py-2 hover:bg-gray-50">
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-sm">Dashboard</span>
              </a>
              
              <a href={currentProfile?.user_type === 'CREATOR' ? `/creator/${currentProfile.id}` : '/profile'} className="flex items-center gap-2 rounded-lg border px-2 py-2 hover:bg-gray-50">
                <User className="h-4 w-4" />
                <span className="text-sm">Profile</span>
              </a>
              
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 rounded-lg border px-2 py-2 hover:bg-gray-50 text-rose-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
            
            <a
              href="/chat/new"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-sm text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </a>
          </div>
        </aside>

        {/* MAIN CHAT */}
        <main className="flex-1 flex flex-col">
          <ChatContainer
            creatorId={selectedCreatorId || undefined}
            fanId={selectedFanId || undefined}
            creatorProfile={creatorProfile || undefined}
            fanProfile={fanProfile || undefined}
          />
        </main>
      </div>

      {/* Welcome modal for new creators */}
      {showWelcome && (
        <CreatorWelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </>
  );
}
