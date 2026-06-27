import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { LeaderAutocomplete } from './LeaderAutocomplete';

const staff = [
  { id: 's1', name: 'Servo João' },
  { id: 's2', name: 'Servo Maria' },
];
const residents = [
  { id: 'r1', name: 'Filho André' },
  { id: 'r2', name: 'Filho Bruno' },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('LeaderAutocomplete', () => {
  it('mostra "Sem líder" quando nada selecionado e abre a lista ao clicar', () => {
    render(
      <LeaderAutocomplete
        selectedId={null}
        selectedType={null}
        onSelect={vi.fn()}
        staff={staff}
        residents={residents}
      />,
    );
    expect(screen.getByText('Sem líder')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sem líder'));
    // ao abrir mostra todas as opções (staff + residents) com seus badges
    expect(screen.getByText('Servo João')).toBeInTheDocument();
    expect(screen.getByText('Filho André')).toBeInTheDocument();
    expect(screen.getAllByText('Servo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Filho').length).toBeGreaterThan(0);
  });

  it('mostra o nome do líder selecionado', () => {
    render(
      <LeaderAutocomplete
        selectedId="s2"
        selectedType="STAFF"
        onSelect={vi.fn()}
        staff={staff}
        residents={residents}
      />,
    );
    expect(screen.getByText('Servo Maria')).toBeInTheDocument();
  });

  it('filtra por busca ignorando acentos/caixa', () => {
    render(
      <LeaderAutocomplete
        selectedId={null}
        selectedType={null}
        onSelect={vi.fn()}
        staff={staff}
        residents={residents}
      />,
    );
    fireEvent.click(screen.getByText('Sem líder'));
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'andre' } });
    expect(screen.getByText('Filho André')).toBeInTheDocument();
    expect(screen.queryByText('Servo João')).not.toBeInTheDocument();
  });

  it('mostra "Nenhum resultado" quando a busca não casa', () => {
    render(
      <LeaderAutocomplete
        selectedId={null}
        selectedType={null}
        onSelect={vi.fn()}
        staff={staff}
        residents={residents}
      />,
    );
    fireEvent.click(screen.getByText('Sem líder'));
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument();
  });

  it('seleciona um servo chamando onSelect com id e tipo', () => {
    const onSelect = vi.fn();
    render(
      <LeaderAutocomplete
        selectedId={null}
        selectedType={null}
        onSelect={onSelect}
        staff={staff}
        residents={residents}
      />,
    );
    fireEvent.click(screen.getByText('Sem líder'));
    fireEvent.mouseDown(screen.getByText('Servo João'));
    expect(onSelect).toHaveBeenCalledWith('s1', 'STAFF');
  });

  it('seleciona "Sem líder" na lista chamando onSelect com null', () => {
    const onSelect = vi.fn();
    render(
      <LeaderAutocomplete
        selectedId="s1"
        selectedType="STAFF"
        onSelect={onSelect}
        staff={staff}
        residents={residents}
      />,
    );
    fireEvent.click(screen.getByText('Servo João'));
    // botão "Sem líder" dentro da lista (o primeiro botão)
    const semLider = screen.getAllByRole('button').find((b) => b.textContent === 'Sem líder');
    fireEvent.mouseDown(semLider!);
    expect(onSelect).toHaveBeenCalledWith(null, null);
  });

  it('fecha a lista ao clicar fora', () => {
    render(
      <div>
        <LeaderAutocomplete
          selectedId={null}
          selectedType={null}
          onSelect={vi.fn()}
          staff={staff}
          residents={residents}
        />
        <button>fora</button>
      </div>,
    );
    fireEvent.click(screen.getByText('Sem líder'));
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('fora'));
    expect(screen.queryByPlaceholderText('Buscar...')).not.toBeInTheDocument();
  });
});
