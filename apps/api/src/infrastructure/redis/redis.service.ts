import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

import { RUNTIME_CONFIG, type RuntimeConfig } from '../../config/runtime-config.js';

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

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

  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(key);
  }

  async setExpiring(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    await this.ensureConnected();
    const result = await this.client.eval(INCREMENT_WITH_EXPIRY_SCRIPT, {
      arguments: [String(ttlSeconds)],
      keys: [key],
    });

    if (typeof result !== 'number') {
      throw new Error('Redis returned an unexpected rate-limit response.');
    }

    return result;
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
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
