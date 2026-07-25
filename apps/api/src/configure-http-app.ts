import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { ApiError } from './common/http/api-error.js';
import { ErrorEnvelopeFilter } from './common/http/error-envelope.filter.js';
import { traceIdMiddleware } from './common/http/trace-id.js';
import type { RuntimeConfig } from './config/runtime-config.js';

interface ConfigurableHttpServer {
  disable(setting: string): void;
  set(setting: string, value: number): void;
}

function validationException(errors: ValidationError[]): ApiError {
  const fields = [...new Set(errors.map((error) => error.property))].sort();

  return new ApiError(422, 'VALIDATION_ERROR', 'No pudimos procesar los datos enviados.', {
    fields,
  });
}

export function configureHttpApp(app: INestApplication, config: RuntimeConfig): void {
  const httpServer = app.getHttpAdapter().getInstance() as ConfigurableHttpServer;

  httpServer.disable('x-powered-by');
  if (config.auth.trustProxyHops > 0) {
    httpServer.set('trust proxy', config.auth.trustProxyHops);
  }

  app.use(traceIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: validationException,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
}
