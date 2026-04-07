import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { DailyRewardModule } from './daily-reward/daily-reward.module';
import { QuestModule } from './quests/quest.module';
import { InventoryModule } from './inventory/inventory.module';
import { EnhancementModule } from './enhancement/enhancement.module';
import { CompanionsModule } from './companions/companions.module';
import { BossModule } from './boss/boss.module';
import { PvpModule } from './pvp/pvp.module';
import { StagesModule } from './stages/stages.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    PlayersModule,
    StagesModule,
    InventoryModule,
    EnhancementModule,
    CompanionsModule,
    BossModule,
    PvpModule,
    DailyRewardModule,
    QuestModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
