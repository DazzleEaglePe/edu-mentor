import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  readonly service: 'api';
  readonly status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get('live')
  getLiveness(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
    };
  }

  @Get('ready')
  getReadiness(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
    };
  }
}
