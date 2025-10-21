import { formatDistanceToNow } from 'date-fns';
import { memo } from 'react';
import type { ChatMessage, Profile } from '@/lib/types/database';

interface ChatMessageProps {
  message: ChatMessage;
  sender: Profile;
  isCurrentUser: boolean;
  showTimestamp?: boolean;
  className?: string;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  sender,
  isCurrentUser,
  showTimestamp = true,
  className = ''
}: ChatMessageProps) {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : ''} ${className}`}>
      <div className={`rounded-2xl px-4 py-2 max-w-[70%] break-words ${
        isCurrentUser
          ? 'bg-blue-600 text-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.15)]'
          : 'bg-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.15)]'
      }`}>
        {message.content}
        
        {showTimestamp && (
          <div className={`text-xs mt-1 opacity-70 ${
            isCurrentUser 
              ? 'text-white/70' 
              : 'text-gray-500'
          }`}>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </div>
        )}
      </div>
    </div>
  );
});

interface MessageGroupProps {
  messages: ChatMessage[];
  sender: Profile;
  isCurrentUser: boolean;
  className?: string;
}

export const MessageGroup = memo(function MessageGroup({
  messages,
  sender,
  isCurrentUser,
  className = ''
}: MessageGroupProps) {
  if (messages.length === 0) return null;

  if (isCurrentUser) {
    // Current user messages - right aligned, grouped
    return (
      <div className={`flex justify-end mb-5 ${className}`}>
        <div className="w-full flex flex-col items-end space-y-1.5 min-w-0">
          {messages.map((message, index) => (
            <div key={message.id} className="msg max-w-[78%] sm:max-w-[62%] min-w-[8ch] rounded-2xl px-3.5 py-2.5 bg-brand-600 text-white leading-6 break-words whitespace-pre-wrap shadow-soft">
              {message.content}
              {index === messages.length - 1 && (
                <span className="time absolute -bottom-5 right-2 text-[10px] text-white/70 opacity-0 transition">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // Other user messages - left aligned, grouped (no avatar)
    return (
      <div className={`flex justify-start mb-5 ${className}`}>
        <div className="w-full flex flex-col items-start space-y-1.5 min-w-0">
          {messages.map((message, index) => (
            <div key={message.id} className="msg max-w-[78%] sm:max-w-[62%] min-w-[8ch] rounded-2xl px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 leading-6 break-words whitespace-pre-wrap shadow-soft">
              {message.content}
              {index === messages.length - 1 && (
                <span className="time absolute -bottom-5 left-2 text-[10px] text-gray-400 opacity-0 transition">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
});

interface MessageListProps {
  messages: ChatMessage[];
  profiles: Record<string, Profile>;
  currentUserId: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function MessageList({
  messages,
  profiles,
  currentUserId,
  loading = false,
  error = null,
  className = ''
}: MessageListProps) {
  // Group consecutive messages by sender
  const messageGroups = messages.reduce((groups: Array<{ sender: Profile; messages: ChatMessage[]; isCurrentUser: boolean }>, message) => {
    const sender = profiles[message.sender_id];
    if (!sender) return groups;

    const isCurrentUser = message.sender_id === currentUserId;
    const lastGroup = groups[groups.length - 1];

    // If the last group is from the same sender and within 5 minutes, add to it
    if (
      lastGroup &&
      lastGroup.sender.id === sender.id &&
      new Date(message.created_at).getTime() - new Date(lastGroup.messages[lastGroup.messages.length - 1].created_at).getTime() < 5 * 60 * 1000
    ) {
      lastGroup.messages.push(message);
    } else {
      // Create a new group
      groups.push({
        sender,
        messages: [message],
        isCurrentUser
      });
    }

    return groups;
  }, []);

  if (loading && messages.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="text-center">
          <p className="text-destructive text-sm mb-2">Failed to load messages</p>
          <p className="text-muted-foreground text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-2">No messages yet</p>
          <p className="text-muted-foreground text-xs">Start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {messageGroups.map((group, index) => (
        <MessageGroup
          key={`${group.sender.id}-${index}`}
          messages={group.messages}
          sender={group.sender}
          isCurrentUser={group.isCurrentUser}
        />
      ))}
    </div>
  );
}
