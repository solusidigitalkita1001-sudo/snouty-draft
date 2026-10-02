/**
 * `/auth/*` — docs/API_CONTRACTS.md §2.
 *
 * Refresh token hidup di cookie `httpOnly` dengan `path=/api/v1/auth`: browser
 * hanya mengirimkannya ke endpoint auth, jadi XSS yang bisa memanggil API lain
 * tetap tidak pernah melihatnya ikut dalam permintaan — dan tidak bisa membacanya
 * dari JS karena `httpOnly`. Access token TIDAK pernah menjadi cookie: ia milik
 * memori klien, dikirim sebagai header oleh kode, bukan otomatis oleh browser —
 * itulah yang membuat CSRF tidak mendapat apa-apa darinya.
 */
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ENTITLEMENTS, type Capability, type Tier } from '../../policy/entitlements.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { userOf, type PublicRequest } from '../../../shared/http/actor.js';
import { AuthService, type AuthenticatedSession } from '../application/auth.service.js';
import { InvalidRefreshTokenError } from '../domain/auth.errors.js';
import { PASSWORD_MAX_LENGTH } from '../domain/password-policy.js';
import { readCookie, type WithGuestSession } from './guest-session.middleware.js';

export const REFRESH_COOKIE = 'snouty_refresh';
/** Browser hanya mengirim cookie refresh ke endpoint auth — bukan ke seluruh API. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

const RegisterDto = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    name: z.string().trim().min(1).max(120),
  })
  .strict();

const LoginDto = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

@Controller('auth')
export class AuthController {
  private readonly secure = process.env['NODE_ENV'] === 'production';

  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() rawBody: unknown,
    @Req() request: Request & WithGuestSession,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = parse(RegisterDto, rawBody);
    const session = await this.auth.register({
      ...body,
      // Dari cookie yang sudah diverifikasi middleware — bukan dari body, yang
      // bisa menyebut sesi tamu milik orang lain.
      ...(request.guestSessionId !== undefined ? { guestSessionId: request.guestSessionId } : {}),
    });
    this.setRefreshCookie(response, session);
    return {
      ...profileOf(session),
      accessToken: session.accessToken,
      resumedConversationId: session.resumedConversationId,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() rawBody: unknown, @Res({ passthrough: true }) response: Response) {
    const body = parse(LoginDto, rawBody);
    const session = await this.auth.login(body);
    this.setRefreshCookie(response, session);
    return { ...profileOf(session), accessToken: session.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readCookie(request.headers.cookie, REFRESH_COOKIE);
    if (token === undefined) throw new InvalidRefreshTokenError('unknown');

    const session = await this.auth.refresh(token);
    this.setRefreshCookie(response, session);
    return { ...profileOf(session), accessToken: session.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readCookie(request.headers.cookie, REFRESH_COOKIE);
    // Pencabutan di SERVER; menghapus cookie hanyalah kesopanan kepada browser.
    if (token !== undefined) await this.auth.logout(token);
    response.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  me(@Req() request: PublicRequest) {
    const actor = userOf(request);
    return {
      userId: actor.id,
      tier: actor.tier,
      roles: actor.roles,
      entitlements: entitlementsOf(actor.tier),
    };
  }

  private setRefreshCookie(response: Response, session: AuthenticatedSession): void {
    response.cookie(REFRESH_COOKIE, session.refresh.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: REFRESH_COOKIE_PATH,
      expires: session.refresh.expiresAt,
    });
  }
}

function profileOf(session: AuthenticatedSession) {
  return {
    userId: session.userId,
    name: session.name,
    tier: session.tier,
    roles: session.roles,
  };
}

/** Kapabilitas milik tier — dipakai UI untuk menampilkan/menyembunyikan (lapis satu). */
function entitlementsOf(tier: Tier): Capability[] {
  return (Object.keys(ENTITLEMENTS) as Capability[]).filter((capability) =>
    ENTITLEMENTS[capability].includes(tier),
  );
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new RequestValidationError([
      ...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'body')),
    ]);
  }
  return result.data;
}
