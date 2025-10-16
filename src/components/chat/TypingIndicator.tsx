import { useEffect, useState } from 'react';
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet';

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; displayName?: string }>;
  className?: string;
}

export function TypingIndicator({ typingUsers, className = '' }: TypingIndicatorProps) {
  const [dots, setDots] = useState('');

  // Animate the dots
  useEffect(() => {
    if (typingUsers.length === 0) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [typingUsers.length]);

  if (typingUsers.length === 0) {
    return null;
  }

  const formatTypingText = () => {
    if (typingUsers.length === 1) {
      const user = typingUsers[0];
      const name = user.displayName || 'Someone';
      return `${name} is typing${dots}`;
    } else if (typingUsers.length === 2) {
      const names = typingUsers.map(u => u.displayName || 'Someone');
      return `${names[0]} and ${names[1]} are typing${dots}`;
    } else {
      return `${typingUsers.length} people are typing${dots}`;
    }
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground ${className}`}>
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{formatTypingText()}</span>
    </div>
  );
}

interface OnlineIndicatorProps {
  isOnline: boolean;
  lastSeen?: Date;
  className?: string;
}

export function OnlineIndicator({ isOnline, lastSeen, className = '' }: OnlineIndicatorProps) {
  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-gray-400'
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {isOnline ? 'Online' : lastSeen ? formatLastSeen(lastSeen) : 'Offline'}
      </span>
    </div>
  );
}

interface PresenceAvatarProps {
  isOnline: boolean;
  profilePictureUrl?: string;
  displayName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PresenceAvatar({ 
  isOnline, 
  profilePictureUrl, 
  displayName, 
  size = 'md',
  className = '' 
}: PresenceAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const indicatorSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-3 h-3'
  };

  const indicatorPositions = {
    sm: 'bottom-0 right-0',
    md: 'bottom-0 right-0',
    lg: 'bottom-1 right-1'
  };

  // Process the profile picture URL using Bunny.net utilities
  const processedImageUrl = profilePictureUrl ? getBunnyStorageUrl(profilePictureUrl) : null;

  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center overflow-hidden`}>
        {processedImageUrl ? (
          <img 
            src={processedImageUrl} 
            alt={displayName || 'User'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              console.log('🖼️ Profile picture failed to load:', processedImageUrl);
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="font-medium text-muted-foreground">${displayName?.charAt(0)?.toUpperCase() || '?'}</span>`;
              }
            }}
          />
        ) : (
          <span className="font-medium text-muted-foreground">
            {displayName?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      
      {/* Online indicator */}
      <div 
        className={`absolute ${indicatorPositions[size]} ${indicatorSizes[size]} rounded-full border-2 border-background ${
          isOnline ? 'bg-green-500' : 'bg-gray-400'
        }`}
      />
    </div>
  );
}
