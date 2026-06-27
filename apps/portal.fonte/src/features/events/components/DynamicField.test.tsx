import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type FieldErrors } from 'react-hook-form';
import type { RegistrationField } from '@fonte/types';
import { DynamicField, type RegistrationFormValues } from './DynamicField';

// RegistrationFileField (caso 'file') importa @/lib/api; isola o transport real.
vi.mock('@/lib/api', () => ({
  api: { events: { public: { uploadRegistrationFile: vi.fn() } } },
}));

function field(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 'f1',
    label: 'Campo',
    type: 'short_text',
    required: false,
    order: 0,
    ...overrides,
  };
}

function Harness({
  field: f,
  errors,
}: {
  field: RegistrationField;
  errors?: FieldErrors<RegistrationFormValues>;
}) {
  const { control, formState } = useForm<RegistrationFormValues>({
    defaultValues: { name: '', contact: '', answers: {} },
  });
  return (
    <DynamicField field={f} eventId="e1" control={control} errors={errors ?? formState.errors} />
  );
}

describe('DynamicField (story 68)', () => {
  it('short_text: renderiza input com placeholder e o "*" quando obrigatório', () => {
    render(<Harness field={field({ type: 'short_text', required: true, placeholder: 'Digite' })} />);
    const input = screen.getByLabelText('Campo *');
    expect(input).toHaveAttribute('placeholder', 'Digite');
    expect(input.tagName).toBe('INPUT');
  });

  it('long_text: renderiza textarea', () => {
    render(<Harness field={field({ type: 'long_text' })} />);
    const el = screen.getByLabelText('Campo');
    expect(el.tagName).toBe('TEXTAREA');
  });

  it('number: renderiza input numérico e aceita digitação', async () => {
    const user = userEvent.setup();
    render(<Harness field={field({ type: 'number' })} />);
    const input = screen.getByLabelText('Campo') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'number');
    await user.type(input, '42');
    expect(input.value).toBe('42');
  });

  it('date: renderiza input de data', () => {
    render(<Harness field={field({ type: 'date' })} />);
    expect(screen.getByLabelText('Campo')).toHaveAttribute('type', 'date');
  });

  it('email: renderiza input de email', () => {
    render(<Harness field={field({ type: 'email' })} />);
    expect(screen.getByLabelText('Campo')).toHaveAttribute('type', 'email');
  });

  it('phone: renderiza input com inputmode tel', () => {
    render(<Harness field={field({ type: 'phone' })} />);
    expect(screen.getByLabelText('Campo')).toHaveAttribute('inputmode', 'tel');
  });

  it('boolean: renderiza checkbox com label inline e alterna o valor', async () => {
    const user = userEvent.setup();
    render(<Harness field={field({ type: 'boolean', label: 'Aceito', required: true })} />);
    // Não há label superior para boolean; o label vem junto do checkbox.
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText(/aceito/i)).toBeInTheDocument();
  });

  it('select: renderiza opções e permite escolher', async () => {
    const user = userEvent.setup();
    render(<Harness field={field({ type: 'select', label: 'Tamanho', options: ['P', 'M'] })} />);
    const select = screen.getByLabelText('Tamanho') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Selecione...' })).toBeInTheDocument();
    await user.selectOptions(select, 'M');
    expect(select.value).toBe('M');
  });

  it('select: usa lista vazia quando options é undefined', () => {
    render(<Harness field={field({ type: 'select', options: undefined })} />);
    // Só a opção placeholder.
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('multi_select: adiciona e remove opções marcando/desmarcando', async () => {
    const user = userEvent.setup();
    render(<Harness field={field({ type: 'multi_select', options: ['A', 'B'] })} />);
    const [a, b] = screen.getAllByRole('checkbox') as HTMLInputElement[];

    await user.click(a);
    expect(a.checked).toBe(true);
    await user.click(b);
    expect(b.checked).toBe(true);
    // Remove o primeiro (branch do filter).
    await user.click(a);
    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });

  it('file: renderiza o RegistrationFileField (input de arquivo)', () => {
    const { container } = render(<Harness field={field({ type: 'file' })} />);
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('exibe a mensagem de erro do campo quando presente', () => {
    const errors = {
      answers: { f1: { message: 'Campo obrigatório', type: 'required' } },
    } as unknown as FieldErrors<RegistrationFormValues>;
    render(<Harness field={field()} errors={errors} />);
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });
});
