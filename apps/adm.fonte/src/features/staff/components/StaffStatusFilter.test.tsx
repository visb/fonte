import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StaffStatusFilter } from './StaffStatusFilter';

afterEach(() => cleanup());

describe('StaffStatusFilter (story 217)', () => {
  it('marca a opção atual e troca para Desligados / Ativos', () => {
    const onChange = vi.fn();
    render(<StaffStatusFilter value="active" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Ativos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Desligados' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Desligados' }));
    expect(onChange).toHaveBeenCalledWith('dismissed');
    fireEvent.click(screen.getByRole('button', { name: 'Ativos' }));
    expect(onChange).toHaveBeenCalledWith('active');
  });
});
