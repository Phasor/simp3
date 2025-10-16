'use client';
import { ChatThread } from './ChatThread';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import type { Profile } from '@/lib/types/database';

interface ChatContainerProps {
  creatorId?: string;
  fanId?: string;
  creatorProfile?: Profile;
  fanProfile?: Profile;
  onBack?: () => void;
  className?: string;
}

export function ChatContainer({
  creatorId,
  fanId,
  creatorProfile,
  fanProfile,
  onBack,
  className = ''
}: ChatContainerProps) {

  // If no specific chat is selected, show chat selection
  if (!creatorId || !fanId || !creatorProfile || !fanProfile) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <ChatSelectionView onBack={onBack} />
      </div>
    );
  }

  return (
    <div className={`h-full ${className}`}>
      <ChatThread
        creatorId={creatorId}
        fanId={fanId}
        creatorProfile={creatorProfile}
        fanProfile={fanProfile}
        onBack={onBack}
      />
    </div>
  );
}

interface ChatSelectionViewProps {
  onBack?: () => void;
}

function ChatSelectionView({ onBack }: ChatSelectionViewProps) {
  const { profile } = useAuth();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
          <p className="text-muted-foreground mb-6">
            {profile?.user_type === 'CREATOR' 
              ? 'Choose a fan to start chatting with from your dashboard.'
              : 'Choose a creator you have access to from your dashboard.'
            }
          </p>

          <button
            onClick={() => {
              const dashboardUrl = profile?.user_type === 'CREATOR' 
                ? '/creator/dashboard' 
                : '/fan/dashboard';
              window.location.href = dashboardUrl;
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatContainer;
