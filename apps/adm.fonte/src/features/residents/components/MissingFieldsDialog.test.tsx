import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { MissingField } from './MissingFieldsDialog';

const updateMutation = { mutate: vi.fn(), isPending: false };
vi.mock('../hooks/useResidents', () => ({ useUpdateResident: () => updateMutation }));

import { MissingFieldsDialog } from './MissingFieldsDialog';

const fields: MissingField[] = [
  { residentField: 'cpf', label: 'CPF', inputType: 'text' },
  { residentField: 'maritalStatus', label: 'Estado civil', inputType: 'select', options: [{ value: 'SINGLE', label: 'Solteiro(a)' }] },
];

function renderDialog(missingFields = fields) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<MissingFieldsDialog open onClose={onClose} missingFields={missingFields} residentId="r1" onSaved={onSaved} />);
  return { onClose, onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMutation.mutate = vi.fn();
});
afterEach(() => cleanup());

describe('MissingFieldsDialog', () => {
  it('fechado não renderiza', () => {
    render(<MissingFieldsDialog open={false} onClose={vi.fn()} missingFields={fields} residentId="r1" onSaved={vi.fn()} />);
    expect(screen.queryByText('Informações incompletas')).not.toBeInTheDocument();
  });

  it('renderiza um campo por missingField (input e select)', () => {
    renderDialog();
    expect(screen.getByText('CPF')).toBeInTheDocument();
    expect(screen.getByText('Estado civil')).toBeInTheDocument();
    expect(screen.getByText('Solteiro(a)')).toBeInTheDocument();
  });

  it('salvar muta apenas os campos preenchidos e chama onSaved + onClose', () => {
    const { onSaved, onClose } = renderDialog();
    updateMutation.mutate = vi.fn((_v, opts) => opts.onSuccess());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12345678900' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar e gerar/ }));
    expect(updateMutation.mutate).toHaveBeenCalledWith({ data: { cpf: '12345678900' } }, expect.any(Object));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar limpa e fecha', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
