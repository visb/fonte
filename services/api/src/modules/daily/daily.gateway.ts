import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { DAILY_SOCKET_EVENTS, DAILY_SOCKET_NAMESPACE } from '@fonte/types';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DailyService, DailyUser } from './daily.service';
import {
  DAILY_APPLIED_EVENT,
  DAILY_MOVED_EVENT,
  DAILY_RESET_EVENT,
  DailyAppliedEvent,
  DailyMovedEvent,
  DailyResetEvent,
  dailyRoom,
} from './daily.events';

/**
 * Story 225 (decisão 10) — realtime do board da daily. Mesmo esquema de auth
 * do `NotificationGateway` (JWT no handshake). O cliente pede
 * `daily:join { sessionId }`; o gateway valida role e casa pelo `DailyService`
 * antes de pôr o socket na room `daily:<sessionId>`. O socket só distribui —
 * todo movimento entra por HTTP, validado por DTO.
 */
@WebSocketGateway({
  namespace: DAILY_SOCKET_NAMESPACE,
  cors: { origin: '*' },
})
export class DailyGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DailyGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly daily: DailyService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ?? this.bearerFromHeaders(client);
    if (!token) {
      this.logger.warn('Daily socket rejected: missing token');
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.user = { userId: payload.sub, role: payload.role } satisfies DailyUser;
    } catch {
      this.logger.warn('Daily socket rejected: invalid token');
      client.disconnect(true);
    }
  }

  @SubscribeMessage(DAILY_SOCKET_EVENTS.JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string } | undefined,
  ): Promise<void> {
    const user = client.data?.user as DailyUser | undefined;
    const sessionId = body?.sessionId;
    if (!user || !sessionId) {
      client.emit(DAILY_SOCKET_EVENTS.ERROR, { message: 'Daily inválida.' });
      return;
    }
    try {
      const session = await this.daily.findSessionForUser(user, sessionId);
      // Uma daily por socket: troca de sessão (Nova daily) sai da room antiga.
      for (const room of client.rooms ?? []) {
        if (room.startsWith('daily:') && room !== dailyRoom(session.id)) await client.leave(room);
      }
      await client.join(dailyRoom(session.id));
      client.emit(DAILY_SOCKET_EVENTS.JOINED, { sessionId: session.id, version: session.version });
    } catch (error) {
      const message = (error as { message?: string })?.message ?? 'Sem acesso a esta daily.';
      client.emit(DAILY_SOCKET_EVENTS.ERROR, { message });
    }
  }

  @OnEvent(DAILY_MOVED_EVENT)
  handleMoved(event: DailyMovedEvent): void {
    this.server?.to(dailyRoom(event.sessionId)).emit(DAILY_SOCKET_EVENTS.MOVED, event);
  }

  @OnEvent(DAILY_APPLIED_EVENT)
  handleApplied(event: DailyAppliedEvent): void {
    this.server?.to(dailyRoom(event.sessionId)).emit(DAILY_SOCKET_EVENTS.APPLIED, event);
  }

  /** Nova sessão aberta: avisa quem ainda está na room da anterior. */
  @OnEvent(DAILY_RESET_EVENT)
  handleReset(event: DailyResetEvent): void {
    this.server?.to(dailyRoom(event.previousSessionId)).emit(DAILY_SOCKET_EVENTS.RESET, event);
  }

  private bearerFromHeaders(client: Socket): string | undefined {
    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
