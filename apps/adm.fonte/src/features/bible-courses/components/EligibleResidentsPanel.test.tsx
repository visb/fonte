import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { EligibleResident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

const enrollMutate = vi.fn();
const markExternalMutate = vi.fn();
const useEligibleResidents = vi.fn();
const useEnrollBulk = vi.fn(() => ({ mutate: enrollMutate, isPending: false, error: null }));
const useMarkExternalCompletion = vi.fn(() => ({ mutate: markExternalMutate, isPending: false }));

vi.mock('../hooks/useBibleCourses', () => ({
  useEligibleResidents: (...args: unknown[]) => useEligibleResidents(...args),
  useEnrollBulk: (...args: unknown[]) => useEnrollBulk(...args),
  useMarkExternalCompletion: (...args: unknown[]) => useMarkExternalCompletion(...args),
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

/** Checkbox "Selecionar todos" do cabeçalho. */
function headerBox() {
  return screen.getByRole('checkbox', { name: 'Selecionar todos' }) as HTMLInputElement;
}
/** Checkboxes das linhas (excluindo o do cabeçalho). */
function rowBoxes() {
  return screen.getAllByRole('checkbox', { name: /^Selecionar Filho/ }) as HTMLInputElement[];
}
/** Botão "já fez" da linha do filho (story 127). */
function markButton(name: string) {
  return screen.getByRole('button', { name: `Marcar ${name} como já fez o curso` });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Depois do clear: `clearAllMocks` derruba o retorno padrão da factory.
  useMarkExternalCompletion.mockReturnValue({ mutate: markExternalMutate, isPending: false });
  useEnrollBulk.mockReturnValue({ mutate: enrollMutate, isPending: false, error: null });
});
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

    const boxes = rowBoxes();
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => b.checked)).toBe(true);

    fireEvent.click(screen.getByText(/Matricular selecionados \(2\)/));
    expect(enrollMutate).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('desmarcar reduz a seleção e envia só os marcados', () => {
    mockQuery({ data: [resident(), resident({ id: 'r2', name: 'Filho B' })] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(rowBoxes()[0]); // desmarca r1

    fireEvent.click(screen.getByText(/Matricular selecionados \(1\)/));
    expect(enrollMutate).toHaveBeenCalledWith(['r2']);
  });

  it('esconde quem já está matriculado', () => {
    mockQuery({ data: [resident(), resident({ id: 'r2', name: 'Filho B' })] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={['r1']} />);
    expect(screen.queryByText('Filho A')).not.toBeInTheDocument();
    expect(screen.getByText('Filho B')).toBeInTheDocument();
  });

  // Story 126: o erro da matrícula em lote virou toast no hook (coberto em
  // useBibleCourses.test.tsx) — o painel não mostra mais o texto inline.
  it('não renderiza erro de mutation inline', () => {
    mockQuery({ data: [resident()] });
    useEnrollBulk.mockReturnValue({
      mutate: enrollMutate,
      isPending: false,
      error: new Error('boom'),
    });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);
    expect(screen.queryByText(/Erro ao matricular|boom/)).not.toBeInTheDocument();
    // A lista segue utilizável apesar do erro.
    expect(screen.getByText('Filho A')).toBeInTheDocument();
  });
});

// Story 127: marcar "já fez" tira o filho da sugestão. O toast com "Desfazer" e
// as invalidações moram no hook da mutation (story 126) e são cobertos em
// useBibleCourses.test.tsx — aqui garantimos o que é do painel: o filho marcado
// não pode ser arrastado para a matrícula em lote logo depois.
describe('EligibleResidentsPanel — "já fez" (story 127)', () => {
  const twoResidents = () => [resident(), resident({ id: 'r2', name: 'Filho B' })];

  it('marcar chama a mutation com o id e o nome do filho', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(markButton('Filho B'));

    // O nome vai junto porque a mensagem do toast é "<nome> marcado como...".
    expect(markExternalMutate).toHaveBeenCalledWith({ residentId: 'r2', residentName: 'Filho B' });
  });

  it('marcar tira o filho da seleção e a contagem do botão cai', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();

    fireEvent.click(markButton('Filho B'));

    expect(screen.getByText('1 de 2 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Matricular selecionados (1)' })).toBeEnabled();
  });

  it('o filho marcado não entra na matrícula em lote', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(markButton('Filho B'));
    fireEvent.click(screen.getByText(/Matricular selecionados \(1\)/));

    expect(enrollMutate).toHaveBeenCalledWith(['r1']);
  });

  it('marcar o único elegível esvazia a seleção e desabilita o botão', () => {
    mockQuery({ data: [resident()] });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(markButton('Filho A'));

    expect(screen.getByRole('button', { name: 'Matricular selecionados (0)' })).toBeDisabled();
  });
});

describe('EligibleResidentsPanel — selecionar todos (story 125)', () => {
  const twoResidents = () => [resident(), resident({ id: 'r2', name: 'Filho B' })];

  it('vem com todos marcados por padrão e cabeçalho checked', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    expect(headerBox().checked).toBe(true);
    expect(headerBox().indeterminate).toBe(false);
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
  });

  it('clicar no cabeçalho com todos marcados esvazia a seleção e desabilita o botão', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(headerBox());

    expect(headerBox().checked).toBe(false);
    expect(headerBox().indeterminate).toBe(false);
    expect(rowBoxes().every((b) => !b.checked)).toBe(true);
    expect(screen.getByText('0 de 2 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Matricular selecionados (0)' })).toBeDisabled();
  });

  it('clicar de novo no cabeçalho remarca todos e reabilita o botão', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(headerBox()); // limpa
    fireEvent.click(headerBox()); // marca todos

    expect(headerBox().checked).toBe(true);
    expect(rowBoxes().every((b) => b.checked)).toBe(true);
    const button = screen.getByRole('button', { name: 'Matricular selecionados (2)' });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(enrollMutate).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('desmarcar um filho deixa o cabeçalho indeterminate', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(rowBoxes()[0]);

    expect(headerBox().checked).toBe(false);
    expect(headerBox().indeterminate).toBe(true);
    expect(screen.getByText('1 de 2 selecionados')).toBeInTheDocument();
  });

  it('remarcar a última linha desmarcada volta o cabeçalho para checked', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(rowBoxes()[0]); // desmarca → parcial
    expect(headerBox().indeterminate).toBe(true);

    fireEvent.click(rowBoxes()[0]); // remarca → todos

    expect(headerBox().checked).toBe(true);
    expect(headerBox().indeterminate).toBe(false);
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
  });

  it('a partir do estado parcial, clicar no cabeçalho marca todos', () => {
    mockQuery({ data: twoResidents() });
    render(<EligibleResidentsPanel classId="c1" enrolledIds={[]} />);

    fireEvent.click(rowBoxes()[0]); // parcial
    fireEvent.click(headerBox());

    expect(headerBox().checked).toBe(true);
    expect(headerBox().indeterminate).toBe(false);
    expect(rowBoxes().every((b) => b.checked)).toBe(true);
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
  });
});
