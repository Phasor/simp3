import { formatTimeRemaining, type ChatAccessStatus } from '@/lib/chatAccess';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ChatAccessStatusProps {
  status: ChatAccessStatus;
  showDetails?: boolean;
  className?: string;
}

export function ChatAccessStatusBadge({ 
  status, 
  showDetails = false, 
  className = '' 
}: ChatAccessStatusProps) {
  const getStatusColor = () => {
    if (!status.hasAccess) return 'bg-red-100 text-red-800 border-red-200';
    if (status.daysRemaining && status.daysRemaining > 7) return 'bg-green-100 text-green-800 border-green-200';
    if (status.daysRemaining && status.daysRemaining > 1) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const getStatusIcon = () => {
    if (!status.hasAccess) return <XCircle className="w-4 h-4" />;
    if (status.daysRemaining && status.daysRemaining > 7) return <CheckCircle className="w-4 h-4" />;
    if (status.daysRemaining && status.daysRemaining > 1) return <AlertTriangle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!status.hasAccess) return 'No Access';
    return formatTimeRemaining(status);
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {showDetails && status.accessUntil && (
        <span className="text-xs opacity-75">
          (until {new Date(status.accessUntil).toLocaleDateString()})
        </span>
      )}
    </div>
  );
}

interface ChatAccessCardProps {
  status: ChatAccessStatus;
  creatorName?: string;
  fanName?: string;
  onUpgrade?: () => void;
  className?: string;
}

export function ChatAccessCard({ 
  status, 
  creatorName, 
  fanName, 
  onUpgrade, 
  className = '' 
}: ChatAccessCardProps) {
  const isExpiringSoon = status.hasAccess && status.daysRemaining !== null && status.daysRemaining <= 3;
  
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-card-foreground">
            Chat Access {creatorName && `with ${creatorName}`} {fanName && `for ${fanName}`}
          </h3>
          <ChatAccessStatusBadge status={status} showDetails />
        </div>
      </div>

      {status.hasAccess ? (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Access expires on {status.accessUntil && new Date(status.accessUntil).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          {isExpiringSoon && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Access expiring soon!</p>
                  <p className="text-yellow-700">
                    Your chat access will expire in {formatTimeRemaining(status).toLowerCase()}. 
                    Make another qualifying purchase to extend access.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              <span>No active chat access</span>
            </div>
          </div>

          <div className="bg-muted rounded-md p-3">
            <p className="text-sm text-muted-foreground mb-2">
              To unlock chat access, make a qualifying purchase of $100 or more.
            </p>
            {onUpgrade && (
              <button
                onClick={onUpgrade}
                className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90 transition-colors"
              >
                Browse Content
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AccessCountdownProps {
  status: ChatAccessStatus;
  className?: string;
}

export function AccessCountdown({ status, className = '' }: AccessCountdownProps) {
  if (!status.hasAccess || !status.timeRemaining) {
    return null;
  }

  const { daysRemaining, hoursRemaining, minutesRemaining } = status;

  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      {daysRemaining !== null && daysRemaining > 0 && (
        <div className="text-center">
          <div className="font-bold text-lg">{daysRemaining}</div>
          <div className="text-muted-foreground">day{daysRemaining !== 1 ? 's' : ''}</div>
        </div>
      )}
      
      {hoursRemaining !== null && (daysRemaining === null || daysRemaining === 0) && (
        <div className="text-center">
          <div className="font-bold text-lg">{hoursRemaining}</div>
          <div className="text-muted-foreground">hour{hoursRemaining !== 1 ? 's' : ''}</div>
        </div>
      )}
      
      {minutesRemaining !== null && (daysRemaining === null || daysRemaining === 0) && (hoursRemaining === null || hoursRemaining === 0) && (
        <div className="text-center">
          <div className="font-bold text-lg">{minutesRemaining}</div>
          <div className="text-muted-foreground">minute{minutesRemaining !== 1 ? 's' : ''}</div>
        </div>
      )}
    </div>
  );
}
