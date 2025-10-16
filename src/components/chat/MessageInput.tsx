'use client';

import { useState, useRef, useCallback, useEffect, memo } from 'react';
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

export const MessageInput = memo(function MessageInput({
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
  }, [message, onSendMessage, sending, disabled, onStopTyping]);

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

    // Auto-resize textarea with improved sizing for pill shape
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, [maxLength, message, onStartTyping, onStopTyping]);

  // Auto-resize functionality on mount and message changes
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const autoGrow = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
      };
      autoGrow();
    }
  }, [message]);

  const canSend = message.trim().length > 0 && !sending && !disabled;

  return (
    <div className={`bg-white/80 dark:bg-gray-950/60 backdrop-blur border-t border-gray-200 dark:border-gray-800 p-3 ${className}`}>
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center gap-3">
        {/* Add button */}
        <button 
          type="button"
          className="shrink-0 p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800" 
          title="Add"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>

        {/* Emoji button */}
        <button 
          type="button"
          className="shrink-0 p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100" 
          title="Emoji"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <path d="M9 9h.01M15 9h.01"/>
          </svg>
        </button>

        {/* Input (pill) */}
        <div className="flex-1 relative">
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Chat access required to send messages' : placeholder}
            disabled={disabled || sending}
            rows={1}
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full px-4 py-2 pr-14 resize-none outline-none leading-6 text-[15px] shadow-sm min-h-[40px] max-h-[160px]"
            style={{ height: 'auto' }}
          />
          <span className="absolute right-14 top-1/2 -translate-y-1/2 text-xs text-gray-400 hidden sm:block">⇧ + ↵</span>
        </div>

        {/* Send button */}
        <button
          id="chat-send"
          type="submit"
          disabled={!canSend}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700 active:translate-y-px transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4 -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14"/>
                <path d="m5 12 7 7"/>
                <path d="m5 12 7-7"/>
              </svg>
              <span>Send</span>
            </>
          )}
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
