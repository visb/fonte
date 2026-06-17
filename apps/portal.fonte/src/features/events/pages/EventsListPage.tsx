import { Link } from 'react-router-dom';
import { BrandHeader } from '@/components/BrandHeader';
import { LoadingState, MessageScreen } from '@/components/StateScreens';
import { getErrorMessage } from '@/lib/errors';
import { usePublicEvents } from '../hooks/useEventsPublic';
import { formatEventDate } from '../lib/formatEventDate';

export function EventsListPage() {
  const { data: events, isLoading, error } = usePublicEvents();

  if (isLoading) return <LoadingState message="Carregando eventos..." />;
  if (error) {
    return (
      <MessageScreen
        emoji="⚠️"
        title="Não foi possível carregar"
        message={getErrorMessage(error, 'Tente novamente em instantes.')}
      />
    );
  }

  if (!events || events.length === 0) {
    return (
      <MessageScreen
        emoji="📭"
        title="Nenhum evento aberto"
        message="No momento não há eventos com inscrições abertas."
      />
    );
  }

  return (
    <div className="page">
      <BrandHeader />
      <div className="card">
        <h2>Eventos</h2>
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id}>
              <Link to={`/eventos/${event.id}`} className="event-link">
                <span className="event-title">{event.title}</span>
                <span className="event-date">{formatEventDate(event.startAt, event.endAt)}</span>
                {event.location && <span className="event-location">{event.location}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
