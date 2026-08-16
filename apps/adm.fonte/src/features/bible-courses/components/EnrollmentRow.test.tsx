import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BibleCourseEnrollment } from '@fonte/api-client';

const updateMutate = vi.fn();
const removeMutate = vi.fn();

vi.mock('../hooks/useBibleCourses', () => ({
  useUpdateEnrollment: () => ({ mutate: updateMutate, isPending: false }),
  useRemoveEnrollment: () => ({ mutate: removeMutate, isPending: false }),
}));

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { EnrollmentRow } from './EnrollmentRow';

function enrollment(overrides: Partial<BibleCourseEnrollment> = {}): BibleCourseEnrollment {
  return {
    id: 'e1',
    residentId: 'r1',
    residentName: 'Filho A',
    residentHouseName: 'Casa Belém',
    residentPhotoThumbUrl: null,
    status: 'ENROLLED',
    ...overrides,
  } as BibleCourseEnrollment;
}

function renderRow(data: BibleCourseEnrollment = enrollment()) {
  return render(
    <MemoryRouter>
      <EnrollmentRow classId="c1" enrollment={data} />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('EnrollmentRow', () => {
  it('mostra nome, casa e status', () => {
    renderRow();
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('Matriculado')).toBeInTheDocument();
  });

  it('matriculado: concluir e marcar desistência alteram status', () => {
    renderRow();
    fireEvent.click(screen.getByTitle('Concluir'));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'e1', data: { status: 'COMPLETED' } });
    fireEvent.click(screen.getByTitle('Marcar desistência'));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'e1', data: { status: 'DROPPED' } });
  });

  it('não-matriculado: reverter volta para ENROLLED', () => {
    renderRow(enrollment({ status: 'COMPLETED' }));
    expect(screen.queryByTitle('Concluir')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Reverter para matriculado'));
    expect(updateMutate).toHaveBeenCalledWith({ id: 'e1', data: { status: 'ENROLLED' } });
  });

  it('remover dispara removeMutation', () => {
    renderRow();
    fireEvent.click(screen.getByTitle('Remover matrícula'));
    expect(removeMutate).toHaveBeenCalledWith('e1');
  });

  it('oculta a casa quando ausente', () => {
    renderRow(enrollment({ residentHouseName: null as unknown as string }));
    expect(screen.queryByText('Casa Belém')).not.toBeInTheDocument();
  });

  // Story 180: foto e caminho para a ficha do filho na linha de matrícula.
  describe('foto e "Ver perfil" (story 180)', () => {
    it('renderiza a foto do filho quando há thumb', () => {
      renderRow(enrollment({ residentPhotoThumbUrl: '/uploads/r1-thumb.jpg' }));
      const img = screen.getByAltText('Filho A');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/uploads/r1-thumb.jpg');
    });

    it('cai no fallback (sem <img>) quando o filho não tem foto', () => {
      const { container } = renderRow(enrollment({ residentPhotoThumbUrl: null }));
      expect(screen.queryByAltText('Filho A')).not.toBeInTheDocument();
      expect(container.querySelector('img')).toBeNull();
    });

    it('"Ver perfil" aponta para a ficha do filho', () => {
      renderRow();
      expect(screen.getByLabelText('Ver perfil de Filho A')).toHaveAttribute(
        'href',
        '/residents/r1',
      );
    });

    // Decisão 1 travada: aqui é MESMA aba, diferente do EligibleResidentRow.
    it('"Ver perfil" abre na mesma aba (sem target="_blank")', () => {
      renderRow();
      expect(screen.getByLabelText('Ver perfil de Filho A')).not.toHaveAttribute('target');
    });

    it('clicar em "Ver perfil" não dispara as mutations da linha', () => {
      renderRow();
      fireEvent.click(screen.getByLabelText('Ver perfil de Filho A'));
      expect(updateMutate).not.toHaveBeenCalled();
      expect(removeMutate).not.toHaveBeenCalled();
    });
  });
});
