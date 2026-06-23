import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type {
  BibleClassGradeRow,
  BibleCourseClass,
  BibleCourseModule,
} from '@fonte/api-client';
import { BibleGradeRow } from './BibleGradeRow';
import { BibleModuleRow } from './BibleModuleRow';
import { BibleClassCard } from './BibleClassCard';

afterEach(() => cleanup());

describe('BibleGradeRow', () => {
  function row(): BibleClassGradeRow {
    return {
      residentId: 'r1',
      residentName: 'Filho A',
      average: 8.5,
      modules: [
        { moduleId: 'm1', examGrade: 9, workGrade: 8, moduleAverage: 8.5 },
        { moduleId: 'm2', examGrade: null, workGrade: null, moduleAverage: null },
      ],
    } as BibleClassGradeRow;
  }

  it('mostra nome, notas e médias; traço para nulos', () => {
    render(
      <table>
        <tbody>
          <BibleGradeRow row={row()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    // grade cells: examGrade · workGrade (texto quebrado em nós; normaliza)
    const cellTexts = screen.getAllByText((_, el) => el?.tagName === 'DIV' && /·/.test(el.textContent ?? ''))
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(cellTexts).toContain('9 · 8');
    expect(cellTexts).toContain('– · –');
  });
});

describe('BibleModuleRow', () => {
  function mod(overrides: Partial<BibleCourseModule> = {}): BibleCourseModule {
    return { id: 'm1', sequence: 1, name: 'Gênesis', notes: 'intro', ...overrides } as BibleCourseModule;
  }

  it('mostra sequência, nome e notas', () => {
    render(<BibleModuleRow module={mod()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Gênesis')).toBeInTheDocument();
    expect(screen.getByText('intro')).toBeInTheDocument();
  });

  it('oculta notas quando ausentes e dispara callbacks', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<BibleModuleRow module={mod({ notes: null as unknown as string })} onEdit={onEdit} onDelete={onDelete} />);
    expect(screen.queryByText('intro')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('BibleClassCard', () => {
  function klass(overrides: Partial<BibleCourseClass> = {}): BibleCourseClass {
    return {
      id: 'c1',
      name: 'Turma 2026',
      status: 'IN_PROGRESS',
      houseName: 'Casa Belém',
      startDate: '2026-01-10',
      endDate: '2026-03-26',
      enrollmentCount: 12,
      ...overrides,
    } as BibleCourseClass;
  }

  it('mostra nome, status, casa e contagem; link para detalhe', () => {
    render(
      <MemoryRouter>
        <BibleClassCard klass={klass()} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Turma 2026')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/bible-courses/c1');
  });

  it('dispara onEdit e onDelete', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <BibleClassCard klass={klass()} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
