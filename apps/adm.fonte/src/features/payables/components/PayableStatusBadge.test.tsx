import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PayableStatus } from '@fonte/types';
import { PayableStatusBadge } from './PayableStatusBadge';

afterEach(() => cleanup());

describe('PayableStatusBadge', () => {
  it('aberta + vencida → "Vencida" destrutiva', () => {
    render(<PayableStatusBadge status={PayableStatus.OPEN} overdue />);
    expect(screen.getByText('Vencida')).toBeInTheDocument();
  });

  it('aberta sem vencer → label do status (não "Vencida")', () => {
    render(<PayableStatusBadge status={PayableStatus.OPEN} />);
    expect(screen.queryByText('Vencida')).not.toBeInTheDocument();
  });

  it('paga → label do status', () => {
    render(<PayableStatusBadge status={PayableStatus.PAID} overdue />);
    // overdue só altera quando status === OPEN
    expect(screen.queryByText('Vencida')).not.toBeInTheDocument();
  });
});
