import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CommitImportRelative } from '@fonte/api-client';
import { ImportFichaRelatives } from './ImportFichaRelatives';

afterEach(() => cleanup());

const base: CommitImportRelative[] = [{ name: 'Maria', phone: '(41) 99999-8888', relationship: 'Mãe' }];

describe('ImportFichaRelatives', () => {
  it('renderiza os familiares recebidos com o telefone já mascarado do preview', () => {
    render(<ImportFichaRelatives value={base} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Nome do familiar 1')).toHaveValue('Maria');
    expect(screen.getByLabelText('Telefone do familiar 1')).toHaveValue('(41) 99999-8888');
  });

  it('editar o nome dispara onChange com o valor atualizado', () => {
    const onChange = vi.fn();
    render(<ImportFichaRelatives value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Nome do familiar 1'), { target: { value: 'Marina' } });
    expect(onChange).toHaveBeenCalledWith([{ name: 'Marina', phone: '(41) 99999-8888', relationship: 'Mãe' }]);
  });

  it('digitar no telefone dispara onChange com o valor mascarado', () => {
    const onChange = vi.fn();
    render(<ImportFichaRelatives value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Telefone do familiar 1'), { target: { value: '4133334444' } });
    expect(onChange).toHaveBeenCalledWith([{ name: 'Maria', phone: '(41) 3333-4444', relationship: 'Mãe' }]);
  });

  it('adicionar inclui um familiar em branco', () => {
    const onChange = vi.fn();
    render(<ImportFichaRelatives value={base} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar familiar' }));
    expect(onChange).toHaveBeenCalledWith([...base, { name: '', phone: '', relationship: '' }]);
  });

  it('renderiza campos vazios quando telefone/parentesco são nulos', () => {
    render(
      <ImportFichaRelatives value={[{ name: 'Ana', phone: null, relationship: null }]} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Telefone do familiar 1')).toHaveValue('');
    expect(screen.getByLabelText('Parentesco do familiar 1')).toHaveValue('');
  });

  it('remover tira o familiar da lista', () => {
    const onChange = vi.fn();
    render(<ImportFichaRelatives value={base} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover familiar 1' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
