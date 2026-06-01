import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAdminEmail } from './admin-emails';
import { AuthUser } from './current-user.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const email = request.user?.email;

    if (email && isAdminEmail(this.config, email)) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}