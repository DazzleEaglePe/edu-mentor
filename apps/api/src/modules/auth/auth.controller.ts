import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';

import { AllowPasswordChangeRequired, Public } from '../../common/auth/auth-metadata.js';
import type { AuthPrincipal } from '../../common/auth/auth-principal.js';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request.js';
import {
  type CookieResponse,
  getRequestHeader,
  getRequestIp,
  parseRequestCookies,
  REFRESH_COOKIE_NAME,
} from '../../common/http/cookies.js';
import { ApiError } from '../../common/http/api-error.js';
import { getOrCreateTraceId } from '../../common/http/trace-id.js';
import { createValidationPipe } from '../../configure-http-app.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { AuthService } from './auth.service.js';
// Runtime imports are required so Nest can reflect DTO classes for ValidationPipe.
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { CsrfService } from './security/csrf.service.js';

interface AuthMeResponse {
  readonly activeEnrollment: AuthPrincipal['activeEnrollment'];
  readonly email: string;
  readonly fullName: string;
  readonly id: string;
  readonly mentorCapabilities: AuthPrincipal['mentorCapabilities'];
  readonly mustChangePassword: boolean;
  readonly organization: AuthPrincipal['organization'];
  readonly roles: AuthPrincipal['roles'];
}

function requirePrincipal(request: AuthenticatedRequest): AuthPrincipal {
  if (request.auth === undefined) {
    throw new Error('Authenticated request is missing its principal.');
  }
  return request.auth;
}

function toAuthMe(principal: AuthPrincipal): AuthMeResponse {
  return {
    activeEnrollment: principal.activeEnrollment,
    email: principal.email,
    fullName: principal.fullName,
    id: principal.userId,
    mentorCapabilities: principal.mentorCapabilities,
    mustChangePassword: principal.mustChangePassword,
    organization: principal.organization,
    roles: principal.roles,
  };
}

function userAgent(request: AuthenticatedRequest): string | null {
  return getRequestHeader(request, 'user-agent')?.slice(0, 512) ?? null;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
  ) {}

  @Public()
  @Get('csrf')
  async getCsrf(@Res({ passthrough: true }) response: CookieResponse): Promise<{
    readonly csrfToken: string;
  }> {
    const challenge = await this.csrf.issue();
    this.cookies.setCsrfBrowserCookie(response, challenge);
    return {
      csrfToken: challenge.csrfToken,
    };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(createValidationPipe(LoginDto)) body: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthMeResponse> {
    const result = await this.auth.login({
      email: body.email,
      ip: getRequestIp(request),
      password: body.password,
      traceId: getOrCreateTraceId(request),
      userAgent: userAgent(request),
    });

    this.cookies.setAuthCookies(response, result);
    return toAuthMe(result.principal);
  }

  @Public()
  @HttpCode(204)
  @Post('refresh')
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    const refreshToken = parseRequestCookies(request).get(REFRESH_COOKIE_NAME);

    if (refreshToken === undefined) {
      this.cookies.clearAuthCookies(response);
      throw new ApiError(401, 'UNAUTHORIZED', 'Debes iniciar sesión.');
    }

    try {
      const result = await this.auth.refresh({
        refreshToken,
        traceId: getOrCreateTraceId(request),
        userAgent: userAgent(request),
      });
      this.cookies.setAuthCookies(response, result);
    } catch (error) {
      this.cookies.clearAuthCookies(response);
      throw error;
    }
  }

  @AllowPasswordChangeRequired()
  @HttpCode(204)
  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.revokeCurrent(requirePrincipal(request), getOrCreateTraceId(request));
    this.cookies.clearAuthCookies(response);
  }

  @AllowPasswordChangeRequired()
  @HttpCode(204)
  @Post('logout-all')
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.revokeAll(requirePrincipal(request), getOrCreateTraceId(request));
    this.cookies.clearAuthCookies(response);
  }

  @AllowPasswordChangeRequired()
  @Get('me')
  getMe(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): AuthMeResponse {
    this.cookies.disableCaching(response);
    return toAuthMe(requirePrincipal(request));
  }

  @AllowPasswordChangeRequired()
  @HttpCode(204)
  @Post('change-password')
  async changePassword(
    @Body(createValidationPipe(ChangePasswordDto)) body: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.changePassword(
      requirePrincipal(request),
      body.currentPassword,
      body.newPassword,
      getOrCreateTraceId(request),
    );
    this.cookies.disableCaching(response);
  }
}
