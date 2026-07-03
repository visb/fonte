import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CommitImportRelative } from '@fonte/api-client';
import { ImportFichaRelatives } from './ImportFichaRelatives';

afterEach(() => cleanup());

const base: CommitImportRelative[] = [{ name: 'Maria', phone: '119', relationship: 'Mãe' }];

describe('ImportFichaRelatives', () => {
  it('renderiza os familiares recebidos', () => {
    render(<ImportFichaRelatives value={base} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Nome do familiar 1')).toHaveValue('Maria');
    expect(screen.getByLabelText('Telefone do familiar 1')).toHaveValue('119');
  });

  it('editar o nome dispara onChange com o valor atualizado', () => {
    const onChange = vi.fn();
    render(<ImportFichaRelatives value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Nome do familiar 1'), { target: { value: 'Marina' } });
    expect(onChange).toHaveBeenCalledWith([{ name: 'Marina', phone: '119', relationship: 'Mãe' }]);
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
