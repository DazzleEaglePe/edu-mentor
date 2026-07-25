import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiError } from '../../common/http/api-error.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

interface DependencyProbe {
  ping(): Promise<void>;
}

type DependencyStatus = 'ok' | 'unavailable';

export interface ReadinessResponse {
  readonly dependencies: {
    readonly postgres: DependencyStatus;
    readonly redis: DependencyStatus;
  };
  readonly service: 'api';
  readonly status: 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly database: DependencyProbe,
    @Inject(RedisService) private readonly redis: DependencyProbe,
  ) {}

  async getReadiness(): Promise<ReadinessResponse> {
    const [postgresResult, redisResult] = await Promise.allSettled([
      this.database.ping(),
      this.redis.ping(),
    ]);
    const dependencies = {
      postgres: this.toDependencyStatus(postgresResult),
      redis: this.toDependencyStatus(redisResult),
    } as const;

    if (dependencies.postgres !== 'ok' || dependencies.redis !== 'ok') {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_NOT_READY',
        'El servicio aún no está listo.',
        { dependencies },
      );
    }

    return {
      dependencies,
      service: 'api',
      status: 'ok',
    };
  }

  private toDependencyStatus(result: PromiseSettledResult<void>): DependencyStatus {
    return result.status === 'fulfilled' ? 'ok' : 'unavailable';
  }
}
