import { useState } from 'react';
import type { Conversation, DirectConversation } from '@fonte/api-client';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  useConversations,
  useDirectConversations,
  useThread,
  useDirectThread,
} from '../hooks/useMessages';
import { ConversationRow } from '../components/ConversationRow';
import { DirectConversationRow } from '../components/DirectConversationRow';
import { ThreadPanel } from '../components/ThreadPanel';

type Tab = 'filhos' | 'servos';

type SelectedThread =
  | { type: 'filhos'; residentId: string; relativeId: string; title: string; residentName: string; relativeName: string }
  | { type: 'servos'; staffId: string; relativeId: string; title: string; residentId: string; residentName: string };

export function MessagesPage() {
  const [tab, setTab] = useState<Tab>('filhos');
  const [selected, setSelected] = useState<SelectedThread | null>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useConversations();
  const { data: directConversations = [], isLoading: loadingDirectConversations } = useDirectConversations();

  const isFilhosSelected = selected?.type === 'filhos';
  const isServosSelected = selected?.type === 'servos';

  const { data: threadMessages = [], isLoading: loadingThread } = useThread(
    isFilhosSelected ? selected.residentId : null,
    isFilhosSelected ? selected.relativeId : null,
  );

  const { data: directMessages = [], isLoading: loadingDirectThread } = useDirectThread(
    isServosSelected ? selected.staffId : null,
    isServosSelected ? selected.relativeId : null,
  );

  const handleSelectConversation = (conv: Conversation) => {
    setSelected({
      type: 'filhos',
      residentId: conv.residentId,
      relativeId: conv.relativeId,
      title: `${conv.residentName} ↔ ${conv.relativeName}`,
      residentName: conv.residentName,
      relativeName: conv.relativeName,
    });
  };

  const handleSelectDirect = (conv: DirectConversation) => {
    setSelected({
      type: 'servos',
      staffId: conv.staffId,
      relativeId: conv.relativeId,
      title: `${conv.staffName} → ${conv.relativeName}`,
      residentId: conv.residentId,
      residentName: conv.residentName,
    });
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSelected(null);
  };

  const currentMessages = isFilhosSelected ? threadMessages : isServosSelected ? directMessages : [];
  const currentLoadingThread = isFilhosSelected ? loadingThread : isServosSelected ? loadingDirectThread : false;

  // Group conversations by house
  const conversationsByHouse = Object.values(
    conversations.reduce<Record<string, { houseId: string; houseName: string; items: Conversation[] }>>((acc, c) => {
      const key = c.houseId || '__';
      if (!acc[key]) acc[key] = { houseId: c.houseId, houseName: c.houseName || 'Sem casa', items: [] };
      acc[key].items.push(c);
      return acc;
    }, {}),
  ).sort((a, b) => a.houseName.localeCompare(b.houseName));

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Mensagens</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTabChange('filhos')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'filhos'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent hover:bg-accent/80 text-foreground',
          )}
        >
          Filhos ↔ Familiares
        </button>
        <button
          onClick={() => handleTabChange('servos')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'servos'
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent hover:bg-accent/80 text-foreground',
          )}
        >
          Servos
        </button>
      </div>

      <div className="flex-1 flex min-h-0 border rounded-lg overflow-hidden">
        {/* Left: conversation list */}
        <div className="w-72 shrink-0 border-r overflow-y-auto">
          {tab === 'filhos' ? (
            loadingConversations ? (
              <LoadingState />
            ) : conversations.length === 0 ? (
              <EmptyState title="Nenhuma conversa" />
            ) : (
              conversationsByHouse.map((group) => (
                <div key={group.houseId}>
                  <div className="px-3 py-1.5 bg-muted/60 border-b sticky top-0 z-10">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.houseName}
                    </span>
                  </div>
                  {group.items.map((conv) => (
                    <ConversationRow
                      key={`${conv.residentId}-${conv.relativeId}`}
                      conversation={conv}
                      isSelected={
                        isFilhosSelected &&
                        selected.residentId === conv.residentId &&
                        selected.relativeId === conv.relativeId
                      }
                      onClick={() => handleSelectConversation(conv)}
                    />
                  ))}
                </div>
              ))
            )
          ) : loadingDirectConversations ? (
            <LoadingState />
          ) : directConversations.length === 0 ? (
            <EmptyState title="Nenhuma conversa direta" />
          ) : (
            directConversations.map((conv) => (
              <DirectConversationRow
                key={`${conv.staffId}-${conv.relativeId}`}
                conversation={conv}
                isSelected={
                  isServosSelected &&
                  selected.staffId === conv.staffId &&
                  selected.relativeId === conv.relativeId
                }
                onClick={() => handleSelectDirect(conv)}
              />
            ))
          )}
        </div>

        {/* Right: thread */}
        <ThreadPanel
          title={selected?.title ?? null}
          messages={currentMessages}
          isLoading={currentLoadingThread}
          showModerationActions={tab === 'filhos'}
          chatMode={tab === 'filhos'}
          chatResidentName={isFilhosSelected ? selected.residentName : undefined}
          residentLinkId={isServosSelected ? selected.residentId : undefined}
          residentLinkName={isServosSelected ? selected.residentName : undefined}
        />
      </div>
    </div>
  );
}
