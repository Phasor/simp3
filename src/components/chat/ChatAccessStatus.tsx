import { type ChatAccessStatus } from '@/lib/utils/chatAccess';
import { CheckCircle, XCircle } from 'lucide-react';

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
    if (!status.hasAccess) return 'bg-red-100 text-black border-red-200';
    return 'bg-green-100 text-black border-green-200';
  };

  const getStatusIcon = () => {
    if (!status.hasAccess) return <XCircle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!status.hasAccess) return 'No Access';
    return 'Active';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span className="text-xs font-medium text-black">{getStatusText()}</span>
      {showDetails && status.accessUntil && (
        <span className="typ-caption opacity-75 text-black">
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
  className?: string;
}

export function ChatAccessCard({
  status,
  creatorName,
  fanName,
  className = ''
}: ChatAccessCardProps) {
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
              <CheckCircle className="w-4 h-4" />
              <span>Keep completing tasks to maintain access</span>
            </div>
          </div>
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
            <p className="text-sm text-muted-foreground">
              Complete tasks and earn devotion to unlock VIP access.
            </p>
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
