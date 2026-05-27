import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, FileUp } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';
import { ReadmissionForm } from '../components/ReadmissionForm';

type Step = 'gateway' | 'readmit-form';

const READMITTABLE = new Set([ResidentStatus.DISCHARGED, ResidentStatus.EVADED]);

export function NewAdmissionGatewayPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('gateway');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Resident[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    api.residents.list({ search: debouncedSearch, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        if (justSelectedRef.current) {
          justSelectedRef.current = false;
          return;
        }
        setResults(res.data);
        setDropdownOpen(res.data.length > 0);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => { cancelled = true; };
  }, [debouncedSearch]);

  // fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (resident: Resident) => {
    justSelectedRef.current = true;
    setSelectedResident(resident);
    setSearch(resident.name);
    setDropdownOpen(false);
  };

  const handleStartReadmit = () => {
    if (selectedResident) setStep('readmit-form');
  };

  if (step === 'readmit-form' && selectedResident) {
    return (
      <ReadmissionForm
        resident={selectedResident}
        onBack={() => setStep('gateway')}
        onSuccess={(id) => navigate(`/residents/${id}?tab=attachments`)}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/residents">
            <ArrowLeft size={16} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Novo acolhimento</h1>
      </div>

      <p className="text-muted-foreground mb-8">
        É o primeiro acolhimento deste filho ou ele já passou pela casa?
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Primeiro acolhimento */}
        <Link
          to="/residents/new"
          className={cn(
            'flex flex-col gap-2 rounded-xl border-2 p-6 transition-colors hover:border-primary hover:bg-primary/5',
            'cursor-pointer select-none',
          )}
        >
          <span className="text-lg font-semibold">Primeiro acolhimento</span>
          <span className="text-sm text-muted-foreground">
            Filho nunca passou pela casa. Preencher cadastro completo.
          </span>
        </Link>

        {/* Importar ficha */}
        <Link
          to="/residents/import"
          className={cn(
            'flex flex-col gap-2 rounded-xl border-2 p-6 transition-colors hover:border-primary hover:bg-primary/5',
            'cursor-pointer select-none',
          )}
        >
          <div className="flex items-center gap-2">
            <FileUp size={18} className="text-muted-foreground" />
            <span className="text-lg font-semibold">Importar ficha</span>
          </div>
          <span className="text-sm text-muted-foreground">
            Enviar o .docx da ficha de acolhimento preenchida e importar automaticamente.
          </span>
        </Link>

        {/* Já passou pela casa */}
        <div
          className={cn(
            'flex flex-col gap-2 rounded-xl border-2 p-6 transition-colors',
            selectedResident ? 'border-primary bg-primary/5' : 'border-muted',
          )}
        >
          <span className="text-lg font-semibold">Já passou pela casa</span>
          <span className="text-sm text-muted-foreground mb-3">
            Buscar pelo nome ou CPF do filho.
          </span>

          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 pr-8"
                placeholder="Nome ou CPF..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (selectedResident) setSelectedResident(null);
                }}
                onFocus={() => results.length > 0 && setDropdownOpen(true)}
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
            </div>

            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-md overflow-hidden">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-center justify-between gap-2"
                    onMouseDown={() => handleSelect(r)}
                  >
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.exitDate
                          ? `Saída: ${new Date(r.exitDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                          : r.house?.name ?? ''}
                      </p>
                    </div>
                    <Badge variant={RESIDENT_STATUS_VARIANT[r.status as ResidentStatus]} className="shrink-0 text-xs">
                      {RESIDENT_STATUS_LABELS[r.status as ResidentStatus] ?? r.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedResident && READMITTABLE.has(selectedResident.status) && (
            <Button type="button" className="mt-2 w-full" onClick={handleStartReadmit}>
              Iniciar reintrodução
            </Button>
          )}

          {selectedResident && !READMITTABLE.has(selectedResident.status) && (
            <p className="text-xs text-muted-foreground mt-2">
              {selectedResident.name} está com status{' '}
              <span className="font-medium">
                {RESIDENT_STATUS_LABELS[selectedResident.status as ResidentStatus] ?? selectedResident.status}
              </span>
              .{' '}
              <Link to={`/residents/${selectedResident.id}`} className="underline text-primary">
                Ver cadastro
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
