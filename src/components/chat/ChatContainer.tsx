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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-6 bg-white">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200"></div>
          <div>
            <div className="font-medium leading-4">Select a conversation</div>
            <div className="text-xs text-gray-500 leading-4">Choose someone to chat with</div>
          </div>
        </div>
        <div></div>
      </header>

      {/* Content */}
      <section className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
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
            <p className="text-gray-500 mb-6">
              {profile?.user_type === 'CREATOR' 
                ? 'Choose a fan to start chatting with from your dashboard.'
                : 'Choose a creator you have access to from your dashboard.'
              }
            </p>

            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-black text-white rounded-md hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ChatContainer;
