import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ControlledDateInput } from './ControlledDateInput';

afterEach(() => cleanup());

const schema = z.object({
  date: z.string().min(1, 'Informe a data'),
  other: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function Form({
  defaultDate = '',
  onSubmit,
  onValueChange,
}: {
  defaultDate?: string;
  onSubmit: (v: Values) => void;
  onValueChange?: (v: string) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { date: defaultDate } });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="dt">Data</label>
      <ControlledDateInput control={control} name="date" id="dt" onValueChange={onValueChange} />
      <ControlledDateInput control={control} name="other" placeholder="outra" />
      {errors.date && <p>{errors.date.message}</p>}
      <button type="submit">Salvar</button>
    </form>
  );
}

describe('ControlledDateInput (story 201)', () => {
  it('mostra o valor inicial do form e envia YYYY-MM-DD no submit', async () => {
    const onSubmit = vi.fn();
    render(<Form defaultDate="2026-03-07" onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Data')).toHaveValue('07/03/2026');
    expect(screen.getByPlaceholderText('outra')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ date: '2026-03-07' });
  });

  it('digitado vira YYYY-MM-DD no form e dispara onValueChange', async () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    render(<Form onSubmit={onSubmit} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '15/08/1975' } });
    expect(onValueChange).toHaveBeenLastCalledWith('1975-08-15');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].date).toBe('1975-08-15');
  });

  it('data inválida chega vazia ao zod, que exibe o erro e marca aria-invalid', async () => {
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '31/02/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe a data')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Data')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Data')).toHaveValue('31/02/2026');
  });
});
