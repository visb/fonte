import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { HouseResidentRow } from './HouseResidentRow';

afterEach(() => cleanup());

const base = {
  id: 'r1',
  name: 'Filho A',
  entryDate: '2026-01-10',
  status: ResidentStatus.ACTIVE,
  photoUrl: null,
  photoThumbUrl: null,
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

  // ─── Avatar (story 181) ───────────────────────────────────────────────────

  it('mostra a foto do filho com alt do nome quando há thumb', () => {
    render(
      <HouseResidentRow
        resident={{ ...base, photoThumbUrl: '/uploads/thumb.jpg' }}
        onSelect={vi.fn()}
      />,
    );
    expect((screen.getByAltText('Filho A') as HTMLImageElement).getAttribute('src')).toBe(
      '/uploads/thumb.jpg',
    );
  });

  it('sem thumb, cai na foto cheia (prova o ??)', () => {
    render(
      <HouseResidentRow
        resident={{ ...base, photoUrl: '/uploads/cheia.jpg' }}
        onSelect={vi.fn()}
      />,
    );
    expect((screen.getByAltText('Filho A') as HTMLImageElement).getAttribute('src')).toBe(
      '/uploads/cheia.jpg',
    );
  });

  it('sem foto nenhuma, mostra o fallback e nenhuma <img>', () => {
    const { container } = render(<HouseResidentRow resident={base} onSelect={vi.fn()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('clicar no avatar também dispara onSelect (o avatar não engole o clique da linha)', () => {
    const onSelect = vi.fn();
    render(
      <HouseResidentRow
        resident={{ ...base, photoThumbUrl: '/uploads/thumb.jpg' }}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByAltText('Filho A'));
    expect(onSelect).toHaveBeenCalledWith('r1');
  });
});
