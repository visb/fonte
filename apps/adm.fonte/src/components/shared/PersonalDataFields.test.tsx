import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { PersonalDataFields } from './PersonalDataFields';

function Harness(props: { includeName?: boolean; nameLabel?: string; onBirth?: (v: string) => void }) {
  const { register, control, watch, formState: { errors } } = useForm({
    defaultValues: { birthDate: '1980-01-31' },
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

  it('aplica máscara de telefone ao digitar', () => {
    render(<Harness />);
    const phone = screen.getByPlaceholderText('(00) 00000-0000') as HTMLInputElement;
    fireEvent.change(phone, { target: { value: '62999998888' } });
    expect(phone.value).toMatch(/\(62\)/);
  });
});
