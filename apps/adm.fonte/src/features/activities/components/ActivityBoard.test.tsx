import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { renderWithClient } from '@/test/utils';
import { ActivityBoard } from './ActivityBoard';

function makeActivity(id: string, title: string, status: ActivityStatus): Activity {
  return {
    id,
    title,
    status,
    house: null,
    responsible: null,
    createdById: 'creator1',
  } as Activity;
}

const handlers = () => ({
  onChangeStatus: vi.fn(),
  onApprove: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onOpenDetails: vi.fn(),
  onInvalidDrop: vi.fn(),
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ActivityBoard', () => {
  it('renderiza as atividades distribuídas no board', () => {
    const activities = [
      makeActivity('a1', 'Limpar pátio', ActivityStatus.TODO),
      makeActivity('a2', 'Regar horta', ActivityStatus.DOING),
      makeActivity('a3', 'Pintar muro', ActivityStatus.DONE),
    ];
    renderWithClient(<ActivityBoard activities={activities} isAdmin role="ADMIN" userId="u1" {...handlers()} />);
    expect(screen.getByText('Limpar pátio')).toBeInTheDocument();
    expect(screen.getByText('Regar horta')).toBeInTheDocument();
    expect(screen.getByText('Pintar muro')).toBeInTheDocument();
  });

  it('renderiza o board mesmo sem atividades', () => {
    const { container } = renderWithClient(
      <ActivityBoard activities={[]} isAdmin={false} role={null} userId={null} {...handlers()} />,
    );
    // colunas presentes (layout de board)
    expect(container.querySelector('.overflow-x-auto')).toBeTruthy();
  });
});
