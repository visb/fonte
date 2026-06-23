import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { ActivityCard } from './ActivityCard';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act1',
    title: 'Limpar pátio',
    status: ActivityStatus.TODO,
    house: { id: 'h1', name: 'Casa Belém' },
    responsible: null,
    createdById: 'creator1',
    ...overrides,
  } as Activity;
}

const handlers = () => ({
  onChangeStatus: vi.fn(),
  onApprove: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onOpenDetails: vi.fn(),
});

function renderCard(activity: Activity, opts: { isAdmin?: boolean; role?: string | null; userId?: string | null } = {}) {
  const h = handlers();
  render(
    <DndContext>
      <ActivityCard
        activity={activity}
        isAdmin={opts.isAdmin ?? false}
        role={opts.role ?? null}
        userId={opts.userId ?? null}
        {...h}
      />
    </DndContext>,
  );
  return h;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ActivityCard', () => {
  it('mostra título, casa e badge de status', () => {
    renderCard(makeActivity());
    expect(screen.getByText('Limpar pátio')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
  });

  it('atividade geral (sem casa) mostra "Geral"', () => {
    renderCard(makeActivity({ house: null }));
    expect(screen.getByText('Geral')).toBeInTheDocument();
  });

  it('DRAFT mostra "Enviar" e dispara REQUESTED', () => {
    const h = renderCard(makeActivity({ status: ActivityStatus.DRAFT }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(h.onChangeStatus).toHaveBeenCalledWith(expect.anything(), ActivityStatus.REQUESTED);
  });

  it('REQUESTED + admin mostra "Aprovar"', () => {
    const h = renderCard(makeActivity({ status: ActivityStatus.REQUESTED }), { isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(h.onApprove).toHaveBeenCalled();
  });

  it('TODO mostra "Iniciar" → DOING', () => {
    const h = renderCard(makeActivity({ status: ActivityStatus.TODO }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(h.onChangeStatus).toHaveBeenCalledWith(expect.anything(), ActivityStatus.DOING);
  });

  it('DOING mostra Voltar/Impedir/Concluir', () => {
    const h = renderCard(makeActivity({ status: ActivityStatus.DOING }), { isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(h.onChangeStatus).toHaveBeenCalledWith(expect.anything(), ActivityStatus.DONE);
    fireEvent.click(screen.getByRole('button', { name: 'Impedir' }));
    expect(h.onChangeStatus).toHaveBeenCalledWith(expect.anything(), ActivityStatus.BLOCKED);
  });

  it('DONE mostra "Reabrir" → DOING', () => {
    const h = renderCard(makeActivity({ status: ActivityStatus.DONE }), { isAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(h.onChangeStatus).toHaveBeenCalledWith(expect.anything(), ActivityStatus.DOING);
  });

  it('clique no card abre detalhes; editar e excluir disparam', () => {
    const h = renderCard(makeActivity());
    fireEvent.click(screen.getByText('Limpar pátio'));
    expect(h.onOpenDetails).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Editar'));
    expect(h.onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(h.onDelete).toHaveBeenCalled();
  });

  it('Enter no card abre detalhes', () => {
    const h = renderCard(makeActivity());
    fireEvent.keyDown(screen.getByText('Limpar pátio').closest('[role="button"]')!, { key: 'Enter' });
    expect(h.onOpenDetails).toHaveBeenCalled();
  });
});
