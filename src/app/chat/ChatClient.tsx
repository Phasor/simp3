'use client'

import { ResponsiveChatLayout } from '@/components/chat/ResponsiveChatLayout';

export default function ChatClient() {
  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <ResponsiveChatLayout />
    </div>
  );
}
