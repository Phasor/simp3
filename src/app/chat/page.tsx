import { ResponsiveChatLayout } from '@/components/chat/ResponsiveChatLayout';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <ResponsiveChatLayout />
    </div>
  );
}
