import { useParams } from 'react-router-dom';
import type { RegisterToEventInput } from '@fonte/types';
import { BrandHeader } from '@/components/BrandHeader';
import { LoadingState, MessageScreen } from '@/components/StateScreens';
import { getErrorMessage } from '@/lib/errors';
import { usePublicEventById, useRegisterToEvent } from '../hooks/useEventsPublic';
import { EventRegistrationForm } from '../components/EventRegistrationForm';
import { formatEventDate } from '../lib/formatEventDate';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: event, isLoading, error } = usePublicEventById(id);
  const register = useRegisterToEvent(id ?? '');

  if (isLoading) return <LoadingState message="Carregando evento..." />;
  if (error || !event) {
    return (
      <MessageScreen
        emoji="🔍"
        title="Evento não encontrado"
        message={getErrorMessage(error, 'O evento que você procura não está disponível.')}
      />
    );
  }

  if (register.isSuccess) {
    return (
      <MessageScreen
        emoji="✅"
        title="Inscrição confirmada"
        message={`Você está inscrito em "${event.title}". Até lá!`}
      />
    );
  }

  const handleSubmit = (data: RegisterToEventInput) => register.mutate(data);

  return (
    <div className="page">
      <BrandHeader />
      <div className="card">
        <h1>{event.title}</h1>
        <p className="event-date">{formatEventDate(event.startAt, event.endAt)}</p>
        {event.location && <p className="event-location">{event.location}</p>}
        {event.bannerUrl && (
          <img src={event.bannerUrl} alt={`Banner de ${event.title}`} className="event-banner" />
        )}
        <p className="event-description">{event.description}</p>
      </div>

      <div className="card">
        <EventRegistrationForm
          event={event}
          submitting={register.isPending}
          error={register.error}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
