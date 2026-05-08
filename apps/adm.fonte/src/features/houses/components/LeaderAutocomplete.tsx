import { useEffect, useRef, useState } from 'react';
import { SELECT_CLASS } from '../constants';

export interface PersonItem { id: string; name: string }
export type LeaderType = 'STAFF' | 'RESIDENT';
export interface SelectedLeader { id: string; type: LeaderType }

interface LeaderOption { id: string; name: string; type: LeaderType }

export function LeaderAutocomplete({
  selectedId, selectedType, onSelect, staff, residents,
}: {
  selectedId: string | null;
  selectedType: LeaderType | null;
  onSelect: (id: string | null, type: LeaderType | null) => void;
  staff: PersonItem[];
  residents: PersonItem[];
}) {
  const allOptions: LeaderOption[] = [
    ...staff.map((s) => ({ id: s.id, name: s.name, type: 'STAFF' as const })),
    ...residents.map((r) => ({ id: r.id, name: r.name, type: 'RESIDENT' as const })),
  ];

  const selectedName =
    selectedId && selectedType
      ? (allOptions.find((o) => o.id === selectedId && o.type === selectedType)?.name ?? '')
      : '';

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? allOptions.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : allOptions;

  const handleSelect = (id: string | null, type: LeaderType | null) => {
    onSelect(id, type);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={`${SELECT_CLASS} cursor-pointer`} onClick={() => setOpen(true)}>
        {open ? (
          <input
            autoFocus
            className="w-full outline-none bg-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={selectedName ? '' : 'text-muted-foreground'}>
            {selectedName || 'Sem líder'}
          </span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="max-h-48 overflow-y-auto py-1">
            <button type="button" className="w-full px-3 py-1.5 text-sm text-left text-muted-foreground hover:bg-accent" onMouseDown={() => handleSelect(null, null)}>
              Sem líder
            </button>
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</p>}
            {filtered.map((o) => (
              <button
                key={`${o.type}-${o.id}`}
                type="button"
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-accent"
                onMouseDown={() => handleSelect(o.id, o.type)}
              >
                <span>{o.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${o.type === 'STAFF' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {o.type === 'STAFF' ? 'Servo' : 'Filho'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
