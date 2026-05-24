import type { Conversation } from '@fonte/api-client';
import { cn } from '@/lib/utils';

interface ConversationRowProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationRow({ conversation, isSelected, onClick }: ConversationRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b',
        isSelected && 'bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium truncate">{conversation.residentName}</span>
            <span className="text-xs text-muted-foreground shrink-0">↔</span>
            <span className="text-sm text-muted-foreground truncate">{conversation.relativeName}</span>
          </div>
          {conversation.lastMessage && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {conversation.lastMessage}
            </p>
          )}
        </div>
        {conversation.pendingCount > 0 && (
          <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-semibold min-w-5 h-5 px-1">
            {conversation.pendingCount}
          </span>
        )}
      </div>
    </button>
  );
}
