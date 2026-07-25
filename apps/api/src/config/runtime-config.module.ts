import { Global, Module } from '@nestjs/common';

import { FEATURE_FLAGS, loadFeatureFlags } from './feature-flags.js';
import { loadRuntimeConfig, RUNTIME_CONFIG } from './runtime-config.js';

@Global()
@Module({
  providers: [
    {
      provide: RUNTIME_CONFIG,
      useFactory: loadRuntimeConfig,
    },
    {
      provide: FEATURE_FLAGS,
      useFactory: loadFeatureFlags,
    },
  ],
  exports: [RUNTIME_CONFIG, FEATURE_FLAGS],
})
export class RuntimeConfigModule {}
