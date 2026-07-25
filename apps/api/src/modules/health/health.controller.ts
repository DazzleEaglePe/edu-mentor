import { Controller, Get, Inject } from '@nestjs/common';

import { HealthService, type ReadinessResponse } from './health.service.js';

interface LivenessResponse {
  readonly service: 'api';
  readonly status: 'ok';
}

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness(): LivenessResponse {
    return {
      service: 'api',
      status: 'ok',
    };
  }

  @Get('ready')
  getReadiness(): Promise<ReadinessResponse> {
    return this.healthService.getReadiness();
  }
}
