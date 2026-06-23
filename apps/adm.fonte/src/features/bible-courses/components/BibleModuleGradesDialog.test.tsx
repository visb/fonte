import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type {
  BibleClassGradeModuleColumn,
  BibleClassGradeRow,
} from '@fonte/api-client';
import { BibleModuleGradesDialog } from './BibleModuleGradesDialog';

const moduleCol = { id: 'm1', name: 'Gênesis' } as BibleClassGradeModuleColumn;

function rows(): BibleClassGradeRow[] {
  return [
    {
      enrollmentId: 'e1',
      residentId: 'r1',
      residentName: 'Filho A',
      average: null,
      modules: [{ moduleId: 'm1', examGrade: 8, workGrade: 7, moduleAverage: 7.5 }],
    },
    {
      enrollmentId: 'e2',
      residentId: 'r2',
      residentName: 'Filho B',
      average: null,
      modules: [{ moduleId: 'm1', examGrade: null, workGrade: null, moduleAverage: null }],
    },
  ] as BibleClassGradeRow[];
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('BibleModuleGradesDialog', () => {
  it('null module não renderiza', () => {
    const { container } = render(
      <BibleModuleGradesDialog open module={null} rows={[]} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renderiza filhos com as notas atuais nos campos', () => {
    render(
      <BibleModuleGradesDialog open module={moduleCol} rows={rows()} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.getByText('Lançar notas — Gênesis')).toBeInTheDocument();
    expect((screen.getByLabelText('Prova de Filho A') as HTMLInputElement).value).toBe('8');
    expect((screen.getByLabelText('Trabalho de Filho A') as HTMLInputElement).value).toBe('7');
  });

  it('salvar envia apenas as células alteradas', () => {
    const onSave = vi.fn();
    render(
      <BibleModuleGradesDialog open module={moduleCol} rows={rows()} onClose={vi.fn()} onSave={onSave} />,
    );
    // muda só a prova do Filho B
    fireEvent.change(screen.getByLabelText('Prova de Filho B'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave).toHaveBeenCalledWith([
      { enrollmentId: 'e2', data: { examGrade: 9, workGrade: null } },
    ]);
  });

  it('nota inválida mostra erro e não salva', () => {
    const onSave = vi.fn();
    render(
      <BibleModuleGradesDialog open module={moduleCol} rows={rows()} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText('Prova de Filho A'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Notas devem estar entre 0 e 10.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sem alterações salva lista vazia', () => {
    const onSave = vi.fn();
    render(
      <BibleModuleGradesDialog open module={moduleCol} rows={rows()} onClose={vi.fn()} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it('mostra erro de salvamento e estado pending', () => {
    render(
      <BibleModuleGradesDialog
        open
        module={moduleCol}
        rows={rows()}
        isPending
        error={new Error('x')}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Erro ao salvar notas. Tente novamente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
