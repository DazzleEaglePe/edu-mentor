import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthorizationPolicy } from './authorization-policy.js';
import { AccessTokenService } from './crypto/access-token.service.js';
import { OpaqueTokenService } from './crypto/opaque-token.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { AccessAuthGuard } from './guards/access-auth.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { PasswordChangeRequiredGuard } from './guards/password-change-required.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AuthRateLimiter } from './security/auth-rate-limiter.js';
import { CsrfService } from './security/csrf.service.js';

@Module({
  controllers: [AuthController],
  exports: [AuthorizationPolicy, PasswordHasher],
  providers: [
    AccessTokenService,
    AuthCookieService,
    AuthRateLimiter,
    AuthRepository,
    AuthService,
    AuthorizationPolicy,
    CsrfService,
    OpaqueTokenService,
    PasswordHasher,
    {
      provide: APP_GUARD,
      useClass: AccessAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PasswordChangeRequiredGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AuthModule {}
