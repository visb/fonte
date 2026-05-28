import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DraftRelative } from '../../lib/types';

interface ImportRelativesStepProps {
  relatives: DraftRelative[];
  onBack: () => void;
  onNext: (relatives: DraftRelative[]) => void;
}

export function ImportRelativesStep({
  relatives: initial,
  onBack,
  onNext,
}: ImportRelativesStepProps) {
  const [list, setList] = useState<DraftRelative[]>(initial);

  const update = (id: string, patch: Partial<DraftRelative>) => {
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    setList((prev) => prev.filter((r) => r.id !== id));
  };

  const addBlank = () => {
    setList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        phone: '',
        relationship: '',
        include: true,
      },
    ]);
  };

  const included = list.filter((r) => r.include);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-semibold">Familiares detectados</h2>
        <p className="text-sm text-muted-foreground">
          {list.length > 0
            ? 'Revise os familiares encontrados na ficha. Marque/desmarque quem será cadastrado.'
            : 'Nenhum familiar foi detectado na ficha. Adicione manualmente se necessário.'}
        </p>
      </div>

      <div className="space-y-3">
        {list.map((rel) => (
          <RelativeCard
            key={rel.id}
            relative={rel}
            onToggle={(include) => update(rel.id, { include })}
            onUpdate={(patch) => update(rel.id, patch)}
            onRemove={() => remove(rel.id)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addBlank}>
        <Plus size={14} />
        Adicionar familiar
      </Button>

      <div className="text-xs text-muted-foreground border-t pt-3">
        {included.length > 0
          ? `${included.length} familiar(es) será(ão) cadastrado(s).`
          : 'Nenhum familiar será cadastrado.'}
      </div>

      <div className="flex justify-between gap-3 pt-4">
        <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
          <ArrowLeft size={14} />
          Voltar
        </Button>
        <Button type="button" className="gap-2" onClick={() => onNext(list)}>
          Próximo: Resumo
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}

// ─── RelativeCard ─────────────────────────────────────────────────────────────

interface RelativeCardProps {
  relative: DraftRelative;
  onToggle: (include: boolean) => void;
  onUpdate: (patch: Partial<DraftRelative>) => void;
  onRemove: () => void;
}

function RelativeCard({ relative, onToggle, onUpdate, onRemove }: RelativeCardProps) {
  const { include } = relative;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3 transition-colors',
        include ? 'border-border bg-card' : 'border-dashed border-muted bg-muted/20 opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5 transition-colors',
            include
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-muted text-muted-foreground',
          )}
          onClick={() => onToggle(!include)}
          aria-label={include ? 'Desmarcar familiar' : 'Incluir familiar'}
        >
          {include ? <UserCheck size={12} /> : <UserX size={12} />}
          {include ? 'Incluir' : 'Ignorar'}
        </button>

        <button
          type="button"
          className="text-muted-foreground hover:text-destructive transition-colors"
          onClick={onRemove}
          aria-label="Remover familiar"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-1 space-y-1">
          <label className="text-xs text-muted-foreground">Nome *</label>
          <Input
            value={relative.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Nome do familiar"
            disabled={!include}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Telefone</label>
          <Input
            value={relative.phone}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder="(00) 00000-0000"
            disabled={!include}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Parentesco</label>
          <Input
            value={relative.relationship}
            onChange={(e) => onUpdate({ relationship: e.target.value })}
            placeholder="Ex: Mãe, Pai..."
            disabled={!include}
          />
        </div>
      </div>
    </div>
  );
}
