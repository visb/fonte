import type { TrackingTimelineEntry } from '../lib/trackingTimeline';
import { IncidentTrackingItem } from './IncidentTrackingItem';
import { TrackingEventItem } from './TrackingEventItem';

interface Props {
  entry: TrackingTimelineEntry;
  residentId: string;
}

/** Item da linha do tempo da aba Acompanhamento: follow-up ou ocorrência (story 228). */
export function TrackingTimelineItem({ entry, residentId }: Props) {
  if (entry.kind === 'incident') {
    return <IncidentTrackingItem incident={entry.incident} residentId={residentId} />;
  }
  return <TrackingEventItem followUp={entry.followUp} />;
}
