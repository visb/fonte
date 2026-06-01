import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { useUpdateResident } from '../hooks/useResidents';
import type { UpdateResidentInput } from '@fonte/api-client';

export interface MissingField {
  residentField: keyof UpdateResidentInput;
  label: string;
  inputType: 'text' | 'date' | 'select';
  options?: { value: string; label: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  missingFields: MissingField[];
  residentId: string;
  onSaved: () => void;
}

export function MissingFieldsDialog({ open, onClose, missingFields, residentId, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const updateMutation = useUpdateResident(residentId);

  const setValue = (field: string, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const handleClose = () => {
    setValues({});
    onClose();
  };

  const handleSave = () => {
    const data: UpdateResidentInput = {};
    for (const f of missingFields) {
      const val = values[f.residentField as string];
      if (val) (data as Record<string, unknown>)[f.residentField as string] = val;
    }
    updateMutation.mutate(
      { data },
      {
        onSuccess: () => {
          setValues({});
          onSaved();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Informações incompletas</DialogTitle>
          <DialogDescription>
            Os campos abaixo são usados pelo template mas estão ausentes no perfil do acolhido. Preencha para continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {missingFields.map((f) => (
            <FormField key={f.residentField as string} label={f.label}>
              {f.inputType === 'select' ? (
                <Select
                  value={values[f.residentField as string] ?? ''}
                  onChange={(e) => setValue(f.residentField as string, e.target.value)}
                >
                  <option value="">Selecione</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={f.inputType}
                  value={values[f.residentField as string] ?? ''}
                  onChange={(e) => setValue(f.residentField as string, e.target.value)}
                />
              )}
            </FormField>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updateMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Salvando...' : 'Salvar e gerar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
