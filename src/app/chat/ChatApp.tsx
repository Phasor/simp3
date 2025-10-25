'use client';

import { ResponsiveChatLayout } from '@/components/chat/ResponsiveChatLayout';
import type { ConversationServer } from '@/lib/types/chat';

interface ChatAppProps {
  initialConversations?: ConversationServer[];
  initialUserId?: string;
}

export default function ChatApp({ initialConversations, initialUserId }: ChatAppProps) {
  return (
    <div className="flex-1 min-h-0">
      <ResponsiveChatLayout 
        initialConversations={initialConversations}
        initialUserId={initialUserId}
      />
    </div>
  );
}

