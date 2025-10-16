'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatInbox } from './ChatInbox';
import { ChatContainer } from './ChatContainer';
import { useAuth } from '@/lib/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/database';

interface ResponsiveChatLayoutProps {
  className?: string;
}

export function ResponsiveChatLayout({ className = '' }: ResponsiveChatLayoutProps) {
  const { profile: currentProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [fanProfile, setFanProfile] = useState<Profile | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showInbox, setShowInbox] = useState(true);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
  }, [isMobile, router, loadProfiles]);

  // Read URL parameters on mount
  useEffect(() => {
    const creatorId = searchParams.get('creator');
    const fanId = searchParams.get('fan');
    
    if (creatorId && fanId) {
      handleSelectConversation(creatorId, fanId);
    }
  }, [searchParams, handleSelectConversation]);

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
      <div className={`h-full ${className}`}>
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
    );
  }

  // Desktop: Show both inbox and conversation side by side
  return (
    <div className={`flex h-full ${className}`}>
      {/* Inbox sidebar */}
      <div className="w-80 border-r border-border flex-shrink-0">
        <ChatInbox
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1">
        <ChatContainer
          creatorId={selectedCreatorId || undefined}
          fanId={selectedFanId || undefined}
          creatorProfile={creatorProfile || undefined}
          fanProfile={fanProfile || undefined}
        />
      </div>
    </div>
  );
}
