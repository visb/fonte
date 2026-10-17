import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { StaffPersonalTab } from './StaffPersonalTab';

function Harness({ maritalStatus = '' }: { maritalStatus?: string }) {
  const { register, control, formState: { errors } } = useForm({ defaultValues: { maritalStatus } });
  return (
    <form>
      <StaffPersonalTab register={register} control={control} errors={errors} />
    </form>
  );
}

afterEach(() => cleanup());

describe('StaffPersonalTab', () => {
  it('renderiza os campos da aba pessoal', () => {
    render(<Harness />);
    expect(screen.getByText('CPF')).toBeInTheDocument();
    expect(screen.getByText('Estado civil')).toBeInTheDocument();
    expect(screen.getByText('Religião')).toBeInTheDocument();
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

  it('carrega o valor salvo (união estável) no select', () => {
    render(<Harness maritalStatus="STABLE_UNION" />);
    const select = document.querySelector('select[name="maritalStatus"]') as HTMLSelectElement;
    expect(select.value).toBe('STABLE_UNION');
  });
});
