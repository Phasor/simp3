'use client';

import { useState, useCallback, memo } from 'react';
import { Plus } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  className?: string;
}

export const MessageInput = memo(function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message...',
  onStartTyping,
  onStopTyping,
  className = ''
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled) return;

    try {
      setSending(true);
      await onSendMessage(trimmedMessage);
      setMessage('');
      onStopTyping?.();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [message, onSendMessage, sending, disabled, onStopTyping]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const prevValue = message;
    setMessage(value);

    // Simple typing indicators
    if (value.length > 0 && prevValue.length === 0) {
      onStartTyping?.();
    } else if (value.length === 0 && prevValue.length > 0) {
      onStopTyping?.();
    }
  }, [message, onStartTyping, onStopTyping]);

  const canSend = message.trim().length > 0 && !sending && !disabled;

  return (
    <div className={`flex items-center gap-1.5 md:gap-2 ${className}`}>
      <button 
        type="button"
        className="rounded-xl border px-2 py-2 md:px-3 text-sm hover:bg-gray-50 flex-shrink-0"
        title="Add attachment"
      >
        <Plus className="h-4 w-4" />
      </button>
      
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-1.5 md:gap-2 min-w-0">
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder={disabled ? 'Chat access required to send messages' : placeholder}
          disabled={disabled || sending}
          className="flex-1 min-w-0 rounded-xl border px-3 py-2 md:px-4 text-sm outline-none focus:ring-2 focus:ring-black/10"
        />
        
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-xl bg-black text-white px-3 py-2 md:px-4 text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 whitespace-nowrap"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
});

interface QuickRepliesProps {
  replies: string[];
  onSelectReply: (reply: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function QuickReplies({
  replies,
  onSelectReply,
  disabled = false,
  className = ''
}: QuickRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <div className={`border-t border-border bg-muted/30 p-3 ${className}`}>
      <p className="text-xs text-muted-foreground mb-2">Quick replies:</p>
      <div className="flex flex-wrap gap-2">
        {replies.map((reply, index) => (
          <button
            key={index}
            onClick={async () => {
              try {
                await onSelectReply(reply);
              } catch (error) {
                console.error('Error sending quick reply:', error);
              }
            }}
            disabled={disabled}
            className="px-3 py-1 text-sm bg-background border border-border rounded-full hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}
