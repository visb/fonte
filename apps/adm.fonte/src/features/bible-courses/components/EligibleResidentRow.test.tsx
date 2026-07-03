import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { EligibleResident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { EligibleResidentRow } from './EligibleResidentRow';

function resident(overrides: Partial<EligibleResident> = {}): EligibleResident {
  return {
    id: 'r1',
    name: 'Filho A',
    photoThumbUrl: null,
    entryDate: '2020-01-01',
    monthsInTreatment: 5,
    houseId: 'h1',
    houseName: 'Casa Belém',
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('EligibleResidentRow', () => {
  it('mostra nome, casa e tempo de casa (plural)', () => {
    render(<EligibleResidentRow resident={resident()} checked onToggle={vi.fn()} />);
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText(/Casa Belém · 5 meses de casa/)).toBeInTheDocument();
  });

  it('usa singular para 1 mês', () => {
    render(
      <EligibleResidentRow
        resident={resident({ monthsInTreatment: 1 })}
        checked
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 mês de casa/)).toBeInTheDocument();
  });

  it('reflete o estado do checkbox e dispara onToggle', () => {
    const onToggle = vi.fn();
    render(<EligibleResidentRow resident={resident()} checked onToggle={onToggle} />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith('r1');
  });

  it('renderiza a foto quando há thumbnail', () => {
    render(
      <EligibleResidentRow
        resident={resident({ photoThumbUrl: 'thumb.jpg' })}
        checked
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByAltText('Filho A')).toHaveAttribute('src', 'thumb.jpg');
  });
});
