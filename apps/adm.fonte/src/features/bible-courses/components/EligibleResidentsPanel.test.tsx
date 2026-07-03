import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { EligibleResident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

const enrollMutate = vi.fn();
const useEligibleResidents = vi.fn();
const useEnrollBulk = vi.fn(() => ({ mutate: enrollMutate, isPending: false, error: null }));

vi.mock('../hooks/useBibleCourses', () => ({
  useEligibleResidents: (...args: unknown[]) => useEligibleResidents(...args),
  useEnrollBulk: (...args: unknown[]) => useEnrollBulk(...args),
}));

import { EligibleResidentsPanel } from './EligibleResidentsPanel';

function resident(overrides: Partial<EligibleResident> = {}): EligibleResident {
  return {
    id: 'r1',
    name: 'Filho A',
    photoThumbUrl: null,
    entryDate: '2020-01-01',
    monthsInTreatment: 5,
    houseId: 'h1',
    houseName: 'Casa Belém',
    ...overrides,
  };
}

function mockQuery(over: Partial<ReturnType<typeof baseQuery>> = {}) {
  useEligibleResidents.mockReturnValue({ ...baseQuery(), ...over });
}
function baseQuery() {
  return { data: [] as EligibleResident[], isLoading: false, isError: false, refetch: vi.fn() };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('EligibleResidentsPanel', () => {
  it('não renderiza nada quando desabilitado', () => {
    mockQuery();
    const { container } = render(
      <EligibleResidentsPanel classId="c1" enrolledIds={[]} enabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra loading', () => {
    mockQuery({ isLoading: true });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('mostra estado de erro', () => {
    mockQuery({ isError: true });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);
    expect(screen.getByText(/erro/i)).toBeInTheDocument();
  });

  it('mostra empty state quando não há elegíveis', () => {
    mockQuery({ data: [] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);
    expect(screen.getByText('Nenhum filho elegível.')).toBeInTheDocument();
  });

  it('lista elegíveis marcados por padrão e matricula todos', () => {
    mockQuery({ data: [resident(), resident({ id: 'r2', name: 'Filho B' })] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => b.checked)).toBe(true);

    fireEvent.click(screen.getByText(/Matricular selecionados \(2\)/));
    expect(enrollMutate).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('desmarcar reduz a seleção e envia só os marcados', () => {
    mockQuery({ data: [resident(), resident({ id: 'r2', name: 'Filho B' })] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(boxes[0]); // desmarca r1

    fireEvent.click(screen.getByText(/Matricular selecionados \(1\)/));
    expect(enrollMutate).toHaveBeenCalledWith(['r2']);
  });

  it('esconde quem já está matriculado', () => {
    mockQuery({ data: [resident(), resident({ id: 'r2', name: 'Filho B' })] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={['r1']} />);
    expect(screen.queryByText('Filho A')).not.toBeInTheDocument();
    expect(screen.getByText('Filho B')).toBeInTheDocument();
  });
});
