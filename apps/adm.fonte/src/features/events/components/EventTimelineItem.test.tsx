import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Event } from '@fonte/api-client';
import { EventAudience } from '@fonte/api-client';
import { EventTimelineItem } from './EventTimelineItem';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    title: 'Retiro',
    description: 'Retiro anual',
    startAt: '2026-09-01T13:00:00.000Z',
    endAt: null,
    location: 'Sede',
    capacity: 30,
    registrationEnabled: true,
    bannerUrl: null,
    ...overrides,
  } as Event;
}

const handlers = () => ({ onEdit: vi.fn(), onDelete: vi.fn(), onViewRegistrations: vi.fn() });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('EventTimelineItem', () => {
  it('mostra título, local, capacidade e badge de inscrição aberta', () => {
    render(<EventTimelineItem event={makeEvent()} highlighted={false} past={false} {...handlers()} />);
    expect(screen.getByText('Retiro')).toBeInTheDocument();
    expect(screen.getByText('Sede')).toBeInTheDocument();
    expect(screen.getByText('30 vagas')).toBeInTheDocument();
    expect(screen.getByTestId('registration-badge')).toHaveTextContent('Inscrição aberta');
  });

  it('highlighted mostra "Próximo"; past mostra "Encerrado"', () => {
    const { rerender } = render(
      <EventTimelineItem event={makeEvent()} highlighted past={false} {...handlers()} />,
    );
    expect(screen.getByText('Próximo')).toBeInTheDocument();
    rerender(<EventTimelineItem event={makeEvent()} highlighted={false} past {...handlers()} />);
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
  });

  it('sem inscrição: badge "Só divulgação" e sem botão Inscritos', () => {
    render(
      <EventTimelineItem
        event={makeEvent({ registrationEnabled: false })}
        highlighted={false}
        past={false}
        {...handlers()}
      />,
    );
    expect(screen.getByTestId('registration-badge')).toHaveTextContent('Só divulgação');
    expect(screen.queryByTestId('view-registrations')).not.toBeInTheDocument();
  });

  it('evento interno mostra badge "Interno" e não o de inscrição (story 94)', () => {
    render(
      <EventTimelineItem
        event={makeEvent({ audience: EventAudience.INTERNAL, registrationEnabled: false })}
        highlighted={false}
        past={false}
        {...handlers()}
      />,
    );
    expect(screen.getByTestId('audience-badge')).toHaveTextContent('Interno');
    expect(screen.queryByTestId('registration-badge')).not.toBeInTheDocument();
  });

  it('capacidade nula mostra "Vagas ilimitadas"; banner renderiza imagem', () => {
    render(
      <EventTimelineItem
        event={makeEvent({ capacity: null, bannerUrl: 'http://img/b.jpg' })}
        highlighted={false}
        past={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('Vagas ilimitadas')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img/b.jpg');
  });

  it('dispara onViewRegistrations, onEdit e onDelete', () => {
    const h = handlers();
    render(<EventTimelineItem event={makeEvent()} highlighted={false} past={false} {...h} />);
    fireEvent.click(screen.getByTestId('view-registrations'));
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(h.onViewRegistrations).toHaveBeenCalled();
    expect(h.onEdit).toHaveBeenCalled();
    expect(h.onDelete).toHaveBeenCalled();
  });
});
