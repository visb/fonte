import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { Staff } from '@fonte/api-client';
import { HouseFormFields } from './HouseFormFields';
import type { HouseFormData } from '../constants';

function Harness({ staffList, errors }: { staffList?: Staff[]; errors?: Record<string, { message?: string }> }) {
  const { register } = useForm<HouseFormData>();
  return <HouseFormFields register={register} errors={errors ?? {}} staffList={staffList ?? []} />;
}

afterEach(() => cleanup());

describe('HouseFormFields', () => {
  it('renderiza os campos da casa', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Cap. filhos')).toBeInTheDocument();
    expect(screen.getByLabelText('Cap. servos')).toBeInTheDocument();
    expect(screen.getByLabelText('UF')).toBeInTheDocument();
    expect(screen.getByLabelText(/Casa mãe/)).toBeInTheDocument();
  });

  it('lista os servos no select de coordenador', () => {
    render(<Harness staffList={[{ id: 's1', name: 'Coord A' }] as Staff[]} />);
    expect(screen.getByText('Coord A')).toBeInTheDocument();
    expect(screen.getByText('Sem coordenador')).toBeInTheDocument();
  });

  it('mostra erro de validação do nome', () => {
    render(<Harness errors={{ name: { message: 'Nome obrigatório' } }} />);
    expect(screen.getByText('Nome obrigatório')).toBeInTheDocument();
  });
});
