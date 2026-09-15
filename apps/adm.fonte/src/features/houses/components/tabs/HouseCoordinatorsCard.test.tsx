import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { House } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => (u ? `cdn/${u}` : null) } }));

import { HouseCoordinatorsCard } from './HouseCoordinatorsCard';

function house(over: Partial<House> = {}): House {
  return {
    id: 'h1',
    name: 'Casa Belém',
    coordinatorId: null,
    coordinators: [],
    ...over,
  } as unknown as House;
}

const ANA = { id: 's1', name: 'Ana', whatsapp: '62999990000', photoUrl: null };
const BRUNO = { id: 's2', name: 'Bruno', whatsapp: null, photoUrl: null };

afterEach(() => cleanup());

describe('HouseCoordinatorsCard (story 194)', () => {
  it('lista os coordenadores da casa', () => {
    render(<HouseCoordinatorsCard house={house({ coordinators: [ANA, BRUNO] })} />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('marca com badge só o titular', () => {
    render(
      <HouseCoordinatorsCard house={house({ coordinators: [ANA, BRUNO], coordinatorId: 's2' })} />,
    );

    const badges = screen.getAllByText('Titular');
    expect(badges).toHaveLength(1);
    // O badge fica na linha do Bruno, não na da Ana.
    expect(badges[0].parentElement?.textContent).toContain('Bruno');
  });

  it('com coordenadores e sem titular nenhum badge aparece', () => {
    render(<HouseCoordinatorsCard house={house({ coordinators: [ANA, BRUNO] })} />);

    expect(screen.queryByText('Titular')).not.toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  // Casa sem coordenador é estado legítimo (decisão 5) — e nunca lista em branco.
  it('casa sem coordenador mostra EmptyState', () => {
    render(<HouseCoordinatorsCard house={house()} />);

    expect(screen.getByText('Nenhum coordenador lotado nesta casa.')).toBeInTheDocument();
  });

  it('casa cujo detalhe não trouxe a lista não quebra', () => {
    render(<HouseCoordinatorsCard house={house({ coordinators: undefined })} />);

    expect(screen.getByText('Nenhum coordenador lotado nesta casa.')).toBeInTheDocument();
  });

  it('mostra o whatsapp mascarado quando existe', () => {
    render(<HouseCoordinatorsCard house={house({ coordinators: [ANA, BRUNO] })} />);

    expect(screen.getByText('(62) 99999-0000')).toBeInTheDocument();
  });
});
