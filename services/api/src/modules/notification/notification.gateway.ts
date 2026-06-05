import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import type { Server, Socket } from 'socket.io';
import { Role } from '@fonte/types';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Staff } from '../staff/staff.entity';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedEvent,
} from './notification.events';

/**
 * Realtime delivery of notifications. Auth happens on the socket.io handshake
 * (token via `handshake.auth.token`). On connect the socket joins the rooms its
 * targeting needs: `user:<id>`, `role:<role>` and (when staff) `house:<houseId>`.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
})
export class NotificationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.bearerFromHeaders(client);

    if (!token) {
      this.logger.warn('Socket connection rejected: missing token');
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      this.logger.warn('Socket connection rejected: invalid token');
      client.disconnect(true);
      return;
    }

    const userId = payload.sub;
    const role = payload.role;

    await client.join(`user:${userId}`);
    if (role) await client.join(`role:${role}`);

    if (role !== Role.ADMIN) {
      const staff = await this.staffRepo.findOne({ where: { userId } });
      if (staff?.houseId) await client.join(`house:${staff.houseId}`);
    }
  }

  /** Forwards a freshly created notification to every targeted room. */
  @OnEvent(NOTIFICATION_CREATED_EVENT)
  handleNotificationCreated(event: NotificationCreatedEvent): void {
    if (!this.server || event.rooms.length === 0) return;
    this.server.to(event.rooms).emit('notification:new', event.payload);
  }

  private bearerFromHeaders(client: Socket): string | undefined {
    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
