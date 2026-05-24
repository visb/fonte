import type { DirectConversation } from '@fonte/api-client';
import { cn } from '@/lib/utils';

interface DirectConversationRowProps {
  conversation: DirectConversation;
  isSelected: boolean;
  onClick: () => void;
}

export function DirectConversationRow({ conversation, isSelected, onClick }: DirectConversationRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b',
        isSelected && 'bg-accent',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{conversation.staffName}</span>
          <span className="text-xs text-muted-foreground shrink-0">→</span>
          <span className="text-sm text-muted-foreground truncate">{conversation.relativeName}</span>
        </div>
        {conversation.residentName && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
            Filho: {conversation.residentName}
          </p>
        )}
        {conversation.lastMessage && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {conversation.lastMessage}
          </p>
        )}
      </div>
    </button>
  );
}
