import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { BibleCourseEnrollment } from '@fonte/api-client';

const updateMutate = vi.fn();
const removeMutate = vi.fn();

vi.mock('../hooks/useBibleCourses', () => ({
  useUpdateEnrollment: () => ({ mutate: updateMutate, isPending: false }),
  useRemoveEnrollment: () => ({ mutate: removeMutate, isPending: false }),
}));

import { EnrollmentRow } from './EnrollmentRow';

function enrollment(overrides: Partial<BibleCourseEnrollment> = {}): BibleCourseEnrollment {
  return {
    id: 'e1',
    residentName: 'Filho A',
    residentHouseName: 'Casa Belém',
    status: 'ENROLLED',
    ...overrides,
  } as BibleCourseEnrollment;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('EnrollmentRow', () => {
  it('mostra nome, casa e status', () => {
    render(<EnrollmentRow classId="c1" enrollment={enrollment()} />);
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('Matriculado')).toBeInTheDocument();
  });

  it('matriculado: concluir e marcar desistência alteram status', () => {
    render(<EnrollmentRow classId="c1" enrollment={enrollment()} />);
    fireEvent.click(screen.getByTitle('Concluir'));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'e1', data: { status: 'COMPLETED' } });
    fireEvent.click(screen.getByTitle('Marcar desistência'));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'e1', data: { status: 'DROPPED' } });
  });

  it('não-matriculado: reverter volta para ENROLLED', () => {
    render(<EnrollmentRow classId="c1" enrollment={enrollment({ status: 'COMPLETED' })} />);
    expect(screen.queryByTitle('Concluir')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Reverter para matriculado'));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'e1', data: { status: 'ENROLLED' } });
  });

  it('remover dispara removeMutation', () => {
    render(<EnrollmentRow classId="c1" enrollment={enrollment()} />);
    fireEvent.click(screen.getByTitle('Remover matrícula'));
    expect(removeMutate).toHaveBeenCalledWith('e1');
  });

  it('oculta a casa quando ausente', () => {
    render(
      <EnrollmentRow
        classId="c1"
        enrollment={enrollment({ residentHouseName: null as unknown as string })}
      />,
    );
    expect(screen.queryByText('Casa Belém')).not.toBeInTheDocument();
  });
});
