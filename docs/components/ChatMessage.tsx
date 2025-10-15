import { formatDistanceToNow } from 'date-fns';
import type { Tables } from '@simp2/shared';

type ChatMessage = Tables<'chat_messages'>;
type Profile = Tables<'profiles'>;

interface ChatMessageProps {
  message: ChatMessage;
  sender: Profile;
  isCurrentUser: boolean;
  showTimestamp?: boolean;
  className?: string;
}

export function ChatMessage({
  message,
  sender,
  isCurrentUser,
  showTimestamp = true,
  className = ''
}: ChatMessageProps) {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`flex flex-col max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3 py-1.5 rounded-lg break-words ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-muted-foreground rounded-bl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {showTimestamp && (
          <div className={`mt-0.5 text-xs text-muted-foreground ${isCurrentUser ? 'text-right' : 'text-left'}`}>
            <span>
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageGroupProps {
  messages: ChatMessage[];
  sender: Profile;
  isCurrentUser: boolean;
  className?: string;
}

export function MessageGroup({
  messages,
  sender,
  isCurrentUser,
  className = ''
}: MessageGroupProps) {
  if (messages.length === 0) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id}
          message={message}
          sender={sender}
          isCurrentUser={isCurrentUser}
          showTimestamp={index === messages.length - 1} // Only show timestamp on last message in group
        />
      ))}
    </div>
  );
}

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
