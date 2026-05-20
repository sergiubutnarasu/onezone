// apps/server/src/gateways/socket-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SocketAuthSchema } from '@onezone/shared';
import { Socket } from 'socket.io';

@Injectable()
export class SocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(SocketAuthGuard.name);

  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    // Extract JWT from Bearer token in auth or from cookie header
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: no token`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return false;
    }

    let payload: { sub: string; email: string };
    try {
      payload = this.jwt.verify(token) as { sub: string; email: string };
    } catch {
      this.logger.warn(`Socket ${client.id} rejected: invalid token`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return false;
    }
    client.data.userId = payload.sub;

    const result = SocketAuthSchema.safeParse(client.handshake.auth);

    if (!result.success) {
      this.logger.warn(
        `Socket ${client.id} rejected: invalid auth — ${result.error.message}`,
      );
      client.emit('error', { message: 'Invalid connection parameters' });
      client.disconnect();
      return false;
    }

    (client as Socket & { parsedAuth: typeof result.data }).parsedAuth = result.data;
    return true;
  }

  private extractToken(client: Socket): string | null {
    // 1. Bearer token in handshake auth (used by terminal)
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken?.startsWith('Bearer ')) {
      return authToken.slice(7);
    }
    if (authToken) {
      return authToken;
    }

    // 2. Cookie from upgrade request headers (used by browser)
    const cookieHeader = client.handshake.headers.cookie ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }

    return null;
  }
}
