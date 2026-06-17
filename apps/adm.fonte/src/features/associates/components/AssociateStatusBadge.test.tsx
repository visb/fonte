import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssociateStatusBadge } from './AssociateStatusBadge';
import { ASSOCIATE_STATUS_LABELS } from '../constants';

describe('AssociateStatusBadge', () => {
  it('renderiza o label correto para cada status', () => {
    const { rerender } = render(<AssociateStatusBadge status="ACTIVE" />);
    expect(screen.getByText(ASSOCIATE_STATUS_LABELS.ACTIVE)).toBeInTheDocument();

    rerender(<AssociateStatusBadge status="PAST_DUE" />);
    expect(screen.getByText(ASSOCIATE_STATUS_LABELS.PAST_DUE)).toBeInTheDocument();

    rerender(<AssociateStatusBadge status="CANCELED" />);
    expect(screen.getByText(ASSOCIATE_STATUS_LABELS.CANCELED)).toBeInTheDocument();

    rerender(<AssociateStatusBadge status="PENDING" />);
    expect(screen.getByText(ASSOCIATE_STATUS_LABELS.PENDING)).toBeInTheDocument();
  });
});
