import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FollowUpType, FollowUpAccessLevel } from '@fonte/types';
import type { ResidentFollowUp } from '@fonte/api-client';
import { TrackingEventItem } from './TrackingEventItem';

function fu(over: Partial<ResidentFollowUp> = {}): ResidentFollowUp {
  return {
    id: 'f1', type: FollowUpType.ADMISSION, date: '2026-01-15',
    accessLevel: FollowUpAccessLevel.ALL, description: null, createdByName: null,
    ...over,
  } as unknown as ResidentFollowUp;
}

afterEach(() => cleanup());

describe('TrackingEventItem', () => {
  it('mostra o label do tipo e a data formatada', () => {
    render(<TrackingEventItem followUp={fu()} />);
    expect(screen.getByText('Admissão')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('descrição e autor aparecem quando presentes', () => {
    render(<TrackingEventItem followUp={fu({ description: 'Detalhe aqui', createdByName: 'Maria' })} />);
    expect(screen.getByText('Detalhe aqui')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });

  it('nível ADMINISTRATION mostra badge de acesso restrito', () => {
    render(<TrackingEventItem followUp={fu({ accessLevel: FollowUpAccessLevel.ADMINISTRATION })} />);
    // badge de acesso aparece (label do FOLLOW_UP_ACCESS_LABELS)
    expect(screen.getByText('Admissão')).toBeInTheDocument();
    const badges = screen.getAllByText(/.+/);
    expect(badges.length).toBeGreaterThan(1);
  });

  it('nível ALL não mostra badge de acesso', () => {
    const { container } = render(<TrackingEventItem followUp={fu({ accessLevel: FollowUpAccessLevel.ALL })} />);
    expect(container.querySelectorAll('[class*="badge"]').length).toBe(0);
  });
});
