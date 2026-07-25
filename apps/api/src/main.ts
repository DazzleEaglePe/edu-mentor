import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { ErrorEnvelopeFilter } from './common/http/error-envelope.filter.js';
import { traceIdMiddleware } from './common/http/trace-id.js';
import { loadRuntimeConfig } from './config/runtime-config.js';

interface ConfigurableHttpServer {
  disable(setting: string): void;
}

async function bootstrap(): Promise<void> {
  const runtimeConfig = loadRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  const httpServer = app.getHttpAdapter().getInstance() as ConfigurableHttpServer;

  httpServer.disable('x-powered-by');
  app.use(traceIdMiddleware);
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  await app.listen(runtimeConfig.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  console.error('API bootstrap failed.', error);
  process.exitCode = 1;
});
