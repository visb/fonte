import { NotificationPushPayload } from '@fonte/types';

/** Internal EventEmitter2 event name emitted by the service, consumed by the gateway. */
export const NOTIFICATION_CREATED_EVENT = 'notification.created';

/** Payload carried by {@link NOTIFICATION_CREATED_EVENT}. */
export interface NotificationCreatedEvent {
  // socket.io rooms to deliver to (user:<id>, role:<role>, house:<houseId>).
  rooms: string[];
  payload: NotificationPushPayload;
}
