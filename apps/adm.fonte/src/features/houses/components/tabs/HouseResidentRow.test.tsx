import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';
import { HouseResidentRow } from './HouseResidentRow';

afterEach(() => cleanup());

const base = {
  id: 'r1',
  name: 'Filho A',
  entryDate: '2026-01-10',
  status: ResidentStatus.ACTIVE,
};

describe('HouseResidentRow', () => {
  it('mostra nome, data de entrada e badge de status', () => {
    render(<HouseResidentRow resident={base} onSelect={vi.fn()} />);
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText(/Entrada:/)).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('mostra "—" quando não há data de entrada', () => {
    render(<HouseResidentRow resident={{ ...base, entryDate: null }} onSelect={vi.fn()} />);
    expect(screen.getByText('Entrada: —')).toBeInTheDocument();
  });

  it('cai no fallback (variant outline e label bruto) para status desconhecido', () => {
    render(
      <HouseResidentRow
        resident={{ ...base, status: 'WEIRD' as ResidentStatus }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('WEIRD')).toBeInTheDocument();
  });

  it('dispara onSelect com o id ao clicar', () => {
    const onSelect = vi.fn();
    render(<HouseResidentRow resident={base} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Filho A'));
    expect(onSelect).toHaveBeenCalledWith('r1');
  });
});
