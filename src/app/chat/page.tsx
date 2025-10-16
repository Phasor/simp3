import { ResponsiveChatLayout } from '@/components/chat/ResponsiveChatLayout';

// Force dynamic rendering for user-specific content
export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="h-full">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-full py-5">
        <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
          <ResponsiveChatLayout />
        </div>
      </div>
    </div>
  );
}
