import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time event hub (other.md §6 — WebSocket event catalog).
 *
 * v1: clients connect to namespace `/events` and send
 * `{ "event": "subscribe", "data": { "rooms": ["squad:<id>", "user:<id>"] } }`
 * to join rooms. JWT-authenticated room enforcement lands with the Redis phase.
 */
@WebSocketGateway({ namespace: '/events', cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    client.join('studio');
    this.logger.debug(`client ${client.id} connected`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { rooms?: string[] }) {
    (payload?.rooms || []).forEach((room) => {
      if (/^(squad|user):[\w-]+$/.test(room)) client.join(room);
    });
    return { event: 'subscribed', data: { rooms: payload?.rooms || [] } };
  }

  emitToRoom(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }

  emitToStudio(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  squadRoom(squadId: string) {
    return `squad:${squadId}`;
  }

  userRoom(userId: string) {
    return `user:${userId}`;
  }
}
