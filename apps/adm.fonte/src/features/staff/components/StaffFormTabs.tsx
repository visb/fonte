import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { StaffTabId } from '../lib/staffSchema';

export interface StaffTabDef {
  id: StaffTabId;
  label: string;
  hasError: boolean;
  content: ReactNode;
}

interface Props {
  tabs: StaffTabDef[];
  activeTab: StaffTabId;
  onTabChange: (id: StaffTabId) => void;
}

// Container de abas do form de servo (story 96). Mantém TODAS as abas montadas
// (oculta as inativas via `hidden`) para preservar os valores digitados ao
// trocar de aba — react-hook-form não perde estado e os refs de register
// continuam ligados. Sinaliza visualmente a aba que tem erro de validação.
export function StaffFormTabs({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div>
      <div className="border-b flex gap-0" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors flex items-center gap-1.5',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.hasError && (
              <span
                aria-label="Aba com erro"
                title="Há campos com erro nesta aba"
                className="inline-block w-1.5 h-1.5 rounded-full bg-destructive"
              />
            )}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          hidden={activeTab !== tab.id}
          className={cn('pt-4 space-y-4', activeTab !== tab.id && 'hidden')}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
