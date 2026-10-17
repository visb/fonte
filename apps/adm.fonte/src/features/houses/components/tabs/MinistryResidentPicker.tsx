import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeForSearch } from '@/lib/utils';
import type { PersonItem } from '../LeaderAutocomplete';

interface Props {
  /** Filhos em acolhimento da casa (já filtrados por `ministryEligibleResidents`). */
  candidates: PersonItem[];
  /** Ids que já são membros — somem da busca. */
  memberIds: Set<string>;
  onAdd: (residentId: string) => void;
  disabled?: boolean;
}

/** Busca de "Adicionar filho" no ministério (story 205). */
export function MinistryResidentPicker({ candidates, memberIds, onAdd, disabled }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      candidates.filter(
        (r) => !memberIds.has(r.id) && normalizeForSearch(r.name).includes(normalizeForSearch(search)),
      ),
    [candidates, memberIds, search],
  );

  return (
    <div className="space-y-1.5">
      <Input
        placeholder="Buscar filho..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">Nenhum filho em acolhimento para adicionar.</p>
      ) : (
        <div className="border border-border rounded-md overflow-hidden max-h-40 overflow-y-auto">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-3 py-1.5 text-sm border-b border-border last:border-0"
            >
              <span>{r.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                disabled={disabled}
                aria-label={`Adicionar ${r.name}`}
                onClick={() => onAdd(r.id)}
              >
                <Plus size={13} className="mr-1" />
                Adicionar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
