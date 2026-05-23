// apps/server/src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateDto } from './dto/activate.dto';
import { AuthUser, CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('device')
  @HttpCode(HttpStatus.OK)
  deviceCode() {
    return this.authService.createDeviceCode();
  }

  @Public()
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body('device_code') deviceCode: string) {
    return this.authService.pollToken(deviceCode);
  }

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async activate(@Body() dto: ActivateDto, @CurrentUser() user: AuthUser) {
    const approved = await this.authService.approveDeviceCode(
      user.id,
      dto.user_code,
    );
    return { approved };
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signup(dto.email, dto.password, dto.name);

    if (!tokens) {
      res.status(201).json({ message: 'If this is a new email, your account has been created.' });
      return;
    }

    this.setCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto.email, dto.password);

    if (!tokens) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    this.setCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body('refreshToken') bodyToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = bodyToken || (req.cookies as Record<string, string>)?.refresh_token;

    if (!token) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    const tokens = await this.authService.refreshToken(token);

    if (!tokens) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    this.setCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Body('refreshToken') bodyToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = bodyToken || (req.cookies as Record<string, string>)?.refresh_token;

    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie('access_token', { path: '/', sameSite: 'strict' });
    res.clearCookie('refresh_token', { path: '/', sameSite: 'strict' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id);
  }

  // ─── Cookie helpers ───────────────────────────────────────────────────────────

  private parseDurationMs(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default:  return 15 * 60 * 1000;
    }
  }

  private setCookies(res: Response, tokens: { access_token: string; refresh_token: string }) {
    const accessMaxAge = this.parseDurationMs(
      this.config.getOrThrow<string>('JWT_EXPIRES_IN'),
    );
    const refreshDays = parseInt(
      this.config.getOrThrow<string>('REFRESH_TOKEN_EXPIRES_IN').replace('d', ''),
      10,
    );
    const refreshMaxAge = refreshDays * 24 * 60 * 60 * 1000;
    const secure = this.config.getOrThrow<string>('WEB_ORIGIN').startsWith('https');

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: accessMaxAge,
    });

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: refreshMaxAge,
    });
  }
}
