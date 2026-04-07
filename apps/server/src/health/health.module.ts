import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService and RedisService are injected via @Global() modules
// (DatabaseModule and RedisModule) — no explicit imports needed here.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
