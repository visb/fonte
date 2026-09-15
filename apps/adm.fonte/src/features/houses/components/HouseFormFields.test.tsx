import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { HouseStaffSummary } from '@fonte/api-client';
import { HouseFormFields } from './HouseFormFields';
import type { HouseFormData } from '../constants';

function Harness({
  coordinators,
  errors,
  isEdit = true,
}: {
  coordinators?: HouseStaffSummary[];
  errors?: Record<string, { message?: string }>;
  isEdit?: boolean;
}) {
  const { register } = useForm<HouseFormData>();
  return (
    <HouseFormFields
      register={register}
      errors={errors ?? {}}
      coordinators={coordinators ?? []}
      isEdit={isEdit}
    />
  );
}

const COORDINATORS = [
  { id: 's1', name: 'Coord A', whatsapp: null, photoUrl: null },
  { id: 's2', name: 'Coord B', whatsapp: null, photoUrl: null },
] as HouseStaffSummary[];

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

  // Story 194: o select do titular lista SÓ os coordenadores daquela casa — não
  // o staff inteiro da organização, que é o que o backend recusa com 400.
  it('em edição lista só os coordenadores recebidos, com a opção "Sem titular"', () => {
    render(<Harness coordinators={COORDINATORS} />);

    const select = screen.getByLabelText('Coordenador titular') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Sem titular',
      'Coord A',
      'Coord B',
    ]);
    expect([...select.options].map((o) => o.value)).toEqual(['', 's1', 's2']);
  });

  it('em edição sem coordenadores o select só oferece "Sem titular"', () => {
    render(<Harness coordinators={[]} />);
    const select = screen.getByLabelText('Coordenador titular') as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
  });

  // Decisão 8: na criação a invariante é insatisfazível — o campo não existe.
  it('na criação não renderiza o campo de titular e explica o porquê', () => {
    render(<Harness coordinators={COORDINATORS} isEdit={false} />);

    expect(screen.queryByLabelText('Coordenador titular')).not.toBeInTheDocument();
    expect(screen.queryByText('Coord A')).not.toBeInTheDocument();
    expect(
      screen.getByText('Defina o titular depois de lotar os coordenadores na casa.'),
    ).toBeInTheDocument();
  });

  it('mostra erro de validação do nome', () => {
    render(<Harness errors={{ name: { message: 'Nome obrigatório' } }} />);
    expect(screen.getByText('Nome obrigatório')).toBeInTheDocument();
  });
});
