import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Role } from '@fonte/types';
import { StaffFormSection } from './StaffFormSection';
import { newStaffSchema, type NewStaffFormData } from '../lib/staffSchema';

// Harness com react-hook-form real: valida a integração das abas (story 96) —
// render de cada aba, preservação de valores ao navegar e sinalização de erro.
function Harness() {
  const { register, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<NewStaffFormData>({
      resolver: zodResolver(newStaffSchema),
      defaultValues: { servesInGroup: false, password: 'secret123' },
    });
  const servesInGroup = watch('servesInGroup');
  const role = watch('role');
  return (
    <form onSubmit={handleSubmit(() => {})}>
      <StaffFormSection
        register={register}
        errors={errors}
        role={role as Role | undefined}
        servesInGroup={!!servesInGroup}
        houses={[{ id: 'h1', name: 'Casa Um' }]}
        supportGroups={[{ id: 'g1', name: 'Grupo Alfa' }]}
        onSelectHouse={() => { setValue('servesInGroup', false); setValue('supportGroupId', ''); }}
        onSelectGroup={() => { setValue('servesInGroup', true); setValue('houseId', ''); }}
        passwordSlot={<div data-testid="password-slot" />}
      />
      <button type="submit">Enviar</button>
    </form>
  );
}

afterEach(() => cleanup());

describe('StaffFormSection', () => {
  it('abre na aba Sistema com os campos de acesso e o passwordSlot', () => {
    render(<Harness />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Sistema' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText('Nome completo')).toBeVisible();
    expect(screen.getByLabelText('Função *')).toBeVisible();
    expect(screen.getByLabelText('Casa *')).toBeVisible();
    expect(screen.getByTestId('password-slot')).toBeVisible();
    // As demais abas ficam montadas, mas ocultas.
    expect(screen.getByPlaceholderText('000.000.000-00')).not.toBeVisible();
  });

  it('navega para as abas Pessoal e Endereço mostrando seus campos', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pessoal' }));
    expect(screen.getByRole('tab', { name: 'Pessoal' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeVisible();
    expect(screen.getByPlaceholderText('Profissão ou ocupação')).toBeVisible();
    expect(screen.getByPlaceholderText('Nome completo')).not.toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Endereço e contato' }));
    expect(screen.getByPlaceholderText('Rua, número, bairro')).toBeVisible();
    expect(screen.getByPlaceholderText('(00) 00000-0000')).toBeVisible();
    expect(screen.getByPlaceholderText('000.000.000-00')).not.toBeVisible();
  });

  it('preserva os valores digitados ao trocar de aba', () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText('Nome completo'), { target: { value: 'Maria' } });

    fireEvent.click(screen.getByRole('tab', { name: 'Pessoal' }));
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), {
      target: { value: '12345678901' },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Sistema' }));
    expect(screen.getByPlaceholderText('Nome completo')).toHaveValue('Maria');

    fireEvent.click(screen.getByRole('tab', { name: 'Pessoal' }));
    expect(screen.getByPlaceholderText('000.000.000-00')).toHaveValue('123.456.789-01');
  });

  it('sinaliza apenas a aba Sistema quando os obrigatórios faltam', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => {
      expect(screen.getAllByLabelText('Aba com erro')).toHaveLength(1);
    });
    const systemTab = screen.getByRole('tab', { name: /Sistema/ });
    expect(systemTab).toContainElement(screen.getByLabelText('Aba com erro'));
  });

  it('mostra o select de nível apenas para papel SERVANT', () => {
    render(<Harness />);
    expect(screen.queryByLabelText('Nível')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Função *'), { target: { value: Role.SERVANT } });
    expect(screen.getByLabelText('Nível')).toBeVisible();
  });

  it('alterna entre servir na casa e no grupo de apoio', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Serve no Grupo de Apoio' }));
    expect(screen.getByLabelText('Grupo de Apoio *')).toBeVisible();
    expect(screen.queryByLabelText('Casa *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Serve na Casa' }));
    expect(screen.getByLabelText('Casa *')).toBeVisible();
  });
});
