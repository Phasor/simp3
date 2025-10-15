'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatInbox } from './ChatInbox';
import { ChatContainer } from './ChatContainer';
import { useAuth } from '@/contexts/AuthContext';
import { createSupabaseBrowser } from '@simp2/shared';
import { ArrowLeft, Menu } from 'lucide-react';
import type { Tables } from '@simp2/shared';

type Profile = Tables<'profiles'>;

interface ResponsiveChatLayoutProps {
  className?: string;
}

export function ResponsiveChatLayout({ className = '' }: ResponsiveChatLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile: currentProfile } = useAuth();
  
  // Get initial conversation from URL params
  const initialCreatorId = searchParams.get('creator');
  const initialFanId = searchParams.get('fan');
  
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(initialCreatorId);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(initialFanId);
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [fanProfile, setFanProfile] = useState<Profile | null>(null);
  const [showMobileInbox, setShowMobileInbox] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, show chat when conversation is selected, inbox otherwise
  useEffect(() => {
    if (isMobile) {
      setShowMobileInbox(!selectedCreatorId || !selectedFanId);
    }
  }, [isMobile, selectedCreatorId, selectedFanId]);

  // Load profiles when conversation is selected
  useEffect(() => {
    let cancelled = false;
    
    const loadProfiles = async () => {
      if (!selectedCreatorId || !selectedFanId) {
        setCreatorProfile(null);
        setFanProfile(null);
        return;
      }

      try {
        setLoading(true);
        const supabase = createSupabaseBrowser();

        const [creatorResult, fanResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', selectedCreatorId)
            .eq('user_type', 'CREATOR')
            .single(),
          supabase
            .from('profiles')
            .select('*')
            .eq('id', selectedFanId)
            .eq('user_type', 'FAN')
            .single()
        ]);

        if (cancelled) return; // Prevent state updates if component unmounted

        if (creatorResult.error || fanResult.error) {
          console.error('Error loading profiles:', { 
            creator: creatorResult.error, 
            fan: fanResult.error 
          });
          
          // If we can't load profiles, it might be an authorization issue
          // Clear the selection to avoid showing broken state
          setSelectedCreatorId(null);
          setSelectedFanId(null);
          setCreatorProfile(null);
          setFanProfile(null);
          return;
        }

        setCreatorProfile(creatorResult.data);
        setFanProfile(fanResult.data);
      } catch (error) {
        console.error('Error loading profiles:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfiles();
    
    return () => {
      cancelled = true;
    };
  }, [selectedCreatorId, selectedFanId]);

  const handleSelectConversation = (creatorId: string, fanId: string) => {
    setSelectedCreatorId(creatorId);
    setSelectedFanId(fanId);
    
    // Update URL without navigation
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('creator', creatorId);
    newSearchParams.set('fan', fanId);
    
    // Use replace to avoid adding to history stack
    window.history.replaceState(
      null, 
      '', 
      `${window.location.pathname}?${newSearchParams.toString()}`
    );

    // On mobile, hide inbox when conversation is selected
    if (isMobile) {
      setShowMobileInbox(false);
    }
  };

  const handleBackToInbox = () => {
    if (isMobile) {
      setShowMobileInbox(true);
      // Clear selection on mobile when going back to inbox
      setSelectedCreatorId(null);
      setSelectedFanId(null);
      setCreatorProfile(null);
      setFanProfile(null);
      
      // Clear URL params
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('creator');
      newSearchParams.delete('fan');
      window.history.replaceState(
        null, 
        '', 
        newSearchParams.toString() ? `${window.location.pathname}?${newSearchParams.toString()}` : window.location.pathname
      );
    }
  };

  const handleBackToDashboard = () => {
    const dashboardUrl = currentProfile?.user_type === 'CREATOR' 
      ? '/creator/dashboard' 
      : '/fan/dashboard';
    router.push(dashboardUrl);
  };

  const selectedConversationId = selectedCreatorId && selectedFanId 
    ? `${selectedCreatorId}|${selectedFanId}` 
    : undefined;

  // Mobile view - show either inbox or chat
  if (isMobile) {
    if (showMobileInbox) {
      return (
        <div className={`min-h-screen flex flex-col bg-background ${className}`}>
          <ChatInbox
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            className="flex-1 overflow-hidden"
          />
        </div>
      );
    } else {
      // Show chat full screen
      return (
        <div className={`min-h-screen bg-background overflow-hidden ${className}`}>
          <ChatContainer
            creatorId={selectedCreatorId || undefined}
            fanId={selectedFanId || undefined}
            creatorProfile={creatorProfile || undefined}
            fanProfile={fanProfile || undefined}
            onBack={handleBackToInbox}
            className="h-full overflow-hidden"
          />
        </div>
      );
    }
  }

  // Desktop view - centered chat window with limited width
  return (
    <div className={`min-h-screen bg-background ${className}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 h-screen flex flex-col">
        <div className="w-full max-w-4xl mx-auto flex bg-background shadow-lg rounded-lg border border-border/50 overflow-hidden h-[90vh]">
          {/* Left column - Inbox */}
          <div className="w-80 flex-shrink-0 border-r border-border/50 bg-card/30">
            <ChatInbox
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleSelectConversation}
              className="h-full"
            />
          </div>

          {/* Right column - Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedCreatorId && selectedFanId && creatorProfile && fanProfile ? (
              <ChatContainer
                creatorId={selectedCreatorId}
                fanId={selectedFanId}
                creatorProfile={creatorProfile}
                fanProfile={fanProfile}
                onBack={handleBackToDashboard}
                className="h-full"
              />
            ) : (
              // Empty state when no conversation is selected
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-muted/20 to-muted/10">
                <div className="text-center max-w-md px-4">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 mb-6">
                    <Menu className="h-10 w-10 text-primary/60" />
                  </div>
                  
                  <h2 className="text-2xl font-semibold tracking-tight mb-2">Select a conversation</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Choose a conversation from the sidebar to start chatting.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}