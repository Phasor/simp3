'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  className?: string;
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message...',
  maxLength = 1000,
  onStartTyping,
  onStopTyping,
  className = ''
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled) return;

    try {
      setSending(true);
      await onSendMessage(trimmedMessage);
      setMessage('');
      
      // Stop typing indicator when message is sent
      onStopTyping?.();
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Don't throw the error, just log it to prevent unhandled promise rejection
    } finally {
      setSending(false);
    }
  }, [message, onSendMessage, sending, disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Create a synthetic form event for handleSubmit
      const syntheticEvent = {
        preventDefault: () => {},
        target: e.target,
        currentTarget: e.currentTarget
      } as React.FormEvent;
      handleSubmit(syntheticEvent);
    }
  }, [handleSubmit]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const prevValue = message;
    
    if (value.length <= maxLength) {
      setMessage(value);
    }

    // Handle typing indicators
    if (value.length > 0 && prevValue.length === 0) {
      // Started typing
      onStartTyping?.();
    } else if (value.length === 0 && prevValue.length > 0) {
      // Stopped typing
      onStopTyping?.();
    }

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, [maxLength, message, onStartTyping, onStopTyping]);

  const canSend = message.trim().length > 0 && !sending && !disabled;

  return (
    <form onSubmit={handleSubmit} className={`border-t border-border bg-background px-4 py-2 ${className}`}>
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Chat access required to send messages' : placeholder}
            disabled={disabled || sending}
            rows={1}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] max-h-[120px]"
            style={{ height: 'auto' }}
          />
          
          {/* Character count */}
          <div className="absolute bottom-1 right-2 text-xs text-muted-foreground">
            {message.length}/{maxLength}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSend}
          className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="mt-1 text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </div>
    </form>
  );
}

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
