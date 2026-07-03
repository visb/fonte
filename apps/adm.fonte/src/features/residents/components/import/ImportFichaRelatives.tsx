import { Plus, Trash2 } from 'lucide-react';
import type { CommitImportRelative } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SectionTitle } from '@/components/shared/FormField';
import { IMPORT_TEXTS, RELATIONSHIP_OPTIONS } from '../../constants';

interface ImportFichaRelativesProps {
  value: CommitImportRelative[];
  onChange: (relatives: CommitImportRelative[]) => void;
}

/**
 * Editor enxuto dos familiares do import, exibido no modal da ficha. Reusa o
 * mesmo shape do commit (`CommitImportRelative`). O commit exige ≥1 familiar
 * (regra de negócio), por isso o modal usa a contagem de nomes preenchidos para
 * liberar/bloquear a aprovação.
 */
export function ImportFichaRelatives({ value, onChange }: ImportFichaRelativesProps) {
  const update = (index: number, patch: Partial<CommitImportRelative>) => {
    onChange(value.map((rel, i) => (i === index ? { ...rel, ...patch } : rel)));
  };
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, { name: '', phone: '', relationship: '' }]);

  return (
    <div className="space-y-3">
      <SectionTitle>{IMPORT_TEXTS.relativesTitle}</SectionTitle>
      {value.map((rel, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            aria-label={`Nome do familiar ${index + 1}`}
            value={rel.name}
            onChange={(e) => update(index, { name: e.target.value })}
            placeholder="Nome *"
          />
          <Input
            aria-label={`Telefone do familiar ${index + 1}`}
            value={rel.phone ?? ''}
            onChange={(e) => update(index, { phone: e.target.value })}
            placeholder="Telefone"
          />
          <Select
            aria-label={`Parentesco do familiar ${index + 1}`}
            value={rel.relationship ?? ''}
            onChange={(e) => update(index, { relationship: e.target.value })}
          >
            <option value="">Parentesco</option>
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remover familiar ${index + 1}`}
            onClick={() => remove(index)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={add}>
        <Plus size={14} />
        {IMPORT_TEXTS.addRelative}
      </Button>
    </div>
  );
}
