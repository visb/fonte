import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const enrollMutate = vi.fn();
let enrollState: { isPending: boolean; error: unknown } = { isPending: false, error: null };
let residentsData: { data: { pages: { data: unknown[] }[] }; isLoading: boolean } = {
  data: { pages: [{ data: [] }] },
  isLoading: false,
};

vi.mock('@/features/residents/hooks/useResidents', () => ({
  useInfiniteResidents: () => residentsData,
}));
vi.mock('../hooks/useBibleCourses', () => ({
  useEnrollResident: () => ({ mutate: enrollMutate, ...enrollState }),
}));

import { EnrollResidentDialog } from './EnrollResidentDialog';

beforeEach(() => {
  vi.clearAllMocks();
  enrollState = { isPending: false, error: null };
  residentsData = {
    data: {
      pages: [
        {
          data: [
            { id: 'r1', name: 'Filho Ana', house: { name: 'Casa Um' } },
            { id: 'r2', name: 'Filho Bruno' },
            { id: 'r3', name: 'Já Matriculado' },
          ],
        },
      ],
    },
    isLoading: false,
  };
});
afterEach(() => cleanup());

describe('EnrollResidentDialog', () => {
  it('lista filhos disponíveis ocultando os já matriculados', () => {
    render(<EnrollResidentDialog open classId="c1" enrolledIds={['r3']} onClose={vi.fn()} />);
    expect(screen.getByText('Filho Ana')).toBeInTheDocument();
    expect(screen.getByText('Casa Um')).toBeInTheDocument();
    expect(screen.getByText('Filho Bruno')).toBeInTheDocument();
    expect(screen.queryByText('Já Matriculado')).not.toBeInTheDocument();
  });

  it('matricular dispara mutate com residentId', () => {
    render(<EnrollResidentDialog open classId="c1" enrolledIds={[]} onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Matricular' })[0]);
    expect(enrollMutate).toHaveBeenCalledWith({ residentId: 'r1' });
  });

  it('loading mostra LoadingState', () => {
    residentsData = { data: undefined as never, isLoading: true };
    render(<EnrollResidentDialog open classId="c1" enrolledIds={[]} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Matricular' })).not.toBeInTheDocument();
  });

  it('sem filhos mostra estado vazio', () => {
    residentsData = { data: { pages: [{ data: [] }] }, isLoading: false };
    render(<EnrollResidentDialog open classId="c1" enrolledIds={[]} onClose={vi.fn()} />);
    expect(screen.getByText('Nenhum filho disponível.')).toBeInTheDocument();
  });

  it('erro de matrícula é exibido', () => {
    enrollState = { isPending: false, error: new Error('falhou') };
    render(<EnrollResidentDialog open classId="c1" enrolledIds={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/falhou|Erro ao matricular/)).toBeInTheDocument();
  });
});
