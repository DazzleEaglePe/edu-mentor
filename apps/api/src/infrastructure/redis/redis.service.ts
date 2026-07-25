import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private connectionAttempt: Promise<void> | undefined;
  private readonly client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    this.client = createClient({
      url: config.redisUrl,
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: false,
      },
    });

    this.client.on('error', (error: Error) => {
      this.logger.warn(
        JSON.stringify({
          errorName: error.name,
          event: 'redis_client_error',
        }),
      );
    });
  }

  async ping(): Promise<void> {
    await this.ensureConnected();

    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error('Redis returned an unexpected health response.');
    }
  }

  onModuleDestroy(): void {
    if (this.client.isOpen) {
      this.client.destroy();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isReady) {
      return;
    }

    this.connectionAttempt ??= this.client
      .connect()
      .then(() => undefined)
      .finally(() => {
        this.connectionAttempt = undefined;
      });

    await this.connectionAttempt;
  }
}
