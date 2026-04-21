// apps/server/src/gateways/message-handlers/message-handler.interface.ts

import { Socket } from 'socket.io';

export interface IMessageHandler<T = unknown> {
  handle(data: T, client: Socket): Promise<{ status: 'ok' | 'error' }>;
}
