import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { FollowUpType } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ResidentFollowUp } from '@fonte/api-client';
import { useBulkCreateContributions } from '../hooks/useResidentFollowUps';
import { getErrorMessage } from '@/lib/errors';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthEntry {
  key: string;
  year: number;
  month: number;
  label: string;
  isoDate: string;
}

function buildLast36Months(): MonthEntry[] {
  const result: MonthEntry[] = [];
  const now = new Date();
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    result.push({ key, year, month, label: MONTH_LABELS[month], isoDate: `${key}-01` });
  }
  return result;
}

interface Props {
  open: boolean;
  onClose: () => void;
  residentId: string;
  existingFollowUps: ResidentFollowUp[];
}

export function ContributionHistoryDialog({ open, onClose, residentId, existingFollowUps }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const mutation = useBulkCreateContributions(residentId);

  const months = useMemo(() => buildLast36Months(), []);

  const existingKeys = useMemo(() => {
    return new Set(
      existingFollowUps
        .filter((f) => f.type === FollowUpType.MONTHLY_CONTRIBUTION)
        .map((f) => String(f.date).slice(0, 7)),
    );
  }, [existingFollowUps]);

  const byYear = useMemo(() => {
    const map = new Map<number, MonthEntry[]>();
    for (const m of months) {
      const list = map.get(m.year) ?? [];
      list.push(m);
      map.set(m.year, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [months]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleClose() {
    setSelected(new Set());
    setError(null);
    onClose();
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    setError(null);
    const months = Array.from(selected).map((key) => ({
      date: `${key}-01`,
    }));
    mutation.mutate(
      { months },
      {
        onSuccess: (result) => {
          if (result.created === 0) {
            handleClose();
            return;
          }
          handleClose();
        },
        onError: (err) => {
          setError(getErrorMessage(err, 'Erro ao salvar contribuições'));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !mutation.isPending && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar histórico de contribuições</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Selecione os meses em que o interno já contribuiu. Meses já registrados estão desabilitados.
        </p>

        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
          {byYear.map(([year, entries]) => (
            <div key={year}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {year}
              </p>
              <div className="grid grid-cols-6 gap-2">
                {entries.map((m) => {
                  const exists = existingKeys.has(m.key);
                  const isSelected = selected.has(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      disabled={exists || mutation.isPending}
                      onClick={() => toggle(m.key)}
                      className={cn(
                        'rounded-md py-2 text-xs font-medium transition-colors border',
                        exists
                          ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-50'
                          : isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:border-primary/60',
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="items-center gap-2">
          <span className="text-sm text-muted-foreground mr-auto">
            {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'mês selecionado' : 'meses selecionados'}` : 'Nenhum mês selecionado'}
          </span>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={selected.size === 0 || mutation.isPending}>
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
