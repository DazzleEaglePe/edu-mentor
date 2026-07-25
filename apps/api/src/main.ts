import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureHttpApp } from './configure-http-app.js';
import { RUNTIME_CONFIG, type RuntimeConfig } from './config/runtime-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const runtimeConfig = app.get<RuntimeConfig>(RUNTIME_CONFIG);

  configureHttpApp(app, runtimeConfig);
  await app.listen(runtimeConfig.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  console.error('API bootstrap failed.', error);
  process.exitCode = 1;
});
