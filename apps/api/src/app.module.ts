import { Module } from '@nestjs/common';

import { FEATURE_FLAGS, loadFeatureFlags } from './config/feature-flags.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [HealthModule],
  providers: [
    {
      provide: FEATURE_FLAGS,
      useFactory: loadFeatureFlags,
    },
  ],
  exports: [FEATURE_FLAGS],
})
export class AppModule {}
