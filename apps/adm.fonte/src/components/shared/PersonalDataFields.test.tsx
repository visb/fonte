import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { maxBirthDateFor, todayInSaoPaulo } from '@fonte/types';
import { PersonalDataFields } from './PersonalDataFields';

function Harness(props: {
  includeName?: boolean;
  nameLabel?: string;
  onBirth?: (v: string) => void;
  initialBirth?: string;
}) {
  const { register, control, watch, formState: { errors } } = useForm({
    defaultValues: { birthDate: props.initialBirth ?? '1980-01-31' },
  });
  props.onBirth?.(watch('birthDate'));
  return (
    <form>
      <PersonalDataFields
        register={register}
        control={control}
        errors={errors}
        includeName={props.includeName}
        nameLabel={props.nameLabel}
      />
    </form>
  );
}

afterEach(() => cleanup());

describe('PersonalDataFields', () => {
  it('renderiza as seções e campos principais', () => {
    render(<Harness />);
    expect(screen.getByText('Identificação')).toBeInTheDocument();
    expect(screen.getByText('Contato')).toBeInTheDocument();
    expect(screen.getByText('Perfil social')).toBeInTheDocument();
    expect(screen.getByText('Saúde')).toBeInTheDocument();
    expect(screen.getByText('Nome completo *')).toBeInTheDocument();
    expect(screen.getByText('CPF')).toBeInTheDocument();
  });

  it('respeita includeName=false (sem campo Nome)', () => {
    render(<Harness includeName={false} />);
    expect(screen.queryByText('Nome completo *')).not.toBeInTheDocument();
  });

  it('usa nameLabel customizado', () => {
    render(<Harness nameLabel="Nome do interno *" />);
    expect(screen.getByText('Nome do interno *')).toBeInTheDocument();
  });

  it('aplica máscara de CPF ao digitar', () => {
    render(<Harness />);
    const cpf = screen.getByPlaceholderText('000.000.000-00') as HTMLInputElement;
    fireEvent.change(cpf, { target: { value: '12345678901' } });
    expect(cpf.value).toBe('123.456.789-01');
  });

  it('data de nascimento usa o DateInput: exibe dd/mm/aaaa e grava YYYY-MM-DD (story 201)', () => {
    let birth = '';
    render(<Harness onBirth={(v) => { birth = v; }} />);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    const input = document.querySelector('input[name="birthDate"]') as HTMLInputElement;
    expect(input.value).toBe('31/01/1980');
    fireEvent.change(input, { target: { value: '20051975' } });
    expect(input.value).toBe('20/05/1975');
    expect(birth).toBe('1975-05-20');
  });

  // Story 202: o calendário do nascimento bloqueia quem ainda não tem 18 anos.
  it('calendário do nascimento tem max = hoje − 18 anos', async () => {
    render(<Harness initialBirth="" />);
    await act(() => new Promise((r) => setTimeout(r, 0)));
    const input = document.querySelector('input[name="birthDate"]') as HTMLInputElement;
    fireEvent.focus(input);
    await screen.findByRole('grid');
    const max = maxBirthDateFor(todayInSaoPaulo());
    const day = (iso: string) =>
      document.querySelector(`[data-day="${iso}"] button`) as HTMLButtonElement | null;
    expect(day(max)).not.toBeDisabled();
    const next = new Date(`${max}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const nextIso = next.toISOString().slice(0, 10);
    if (day(nextIso)) expect(day(nextIso)).toBeDisabled();
  });

  // Story 210 — o select de estado civil traz as 5 opções na ordem de exibição.
  it('select de estado civil lista as 5 opções em ordem', () => {
    render(<Harness />);
    const select = document.querySelector('select[name="maritalStatus"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => [o.value, o.text])).toEqual([
      ['', 'Selecione'],
      ['SINGLE', 'Solteiro(a)'],
      ['MARRIED', 'Casado(a)'],
      ['STABLE_UNION', 'União estável'],
      ['DIVORCED', 'Divorciado(a)'],
      ['WIDOWED', 'Viúvo(a)'],
    ]);
  });

  it('aplica máscara de telefone ao digitar', () => {
    render(<Harness />);
    const phone = screen.getByPlaceholderText('(00) 00000-0000') as HTMLInputElement;
    fireEvent.change(phone, { target: { value: '62999998888' } });
    expect(phone.value).toMatch(/\(62\)/);
  });
});
