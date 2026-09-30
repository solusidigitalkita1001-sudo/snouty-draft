import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { healthServiceProvider } from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [healthServiceProvider],
})
export class HealthModule {}
