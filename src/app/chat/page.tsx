import { ResponsiveChatLayout } from '@/components/chat/ResponsiveChatLayout';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="h-screen">
      <ResponsiveChatLayout />
    </div>
  );
}
