import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(config: AppConfigService) {
    super({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    this.on('connect', () => this.logger.log('Redis connected'));
    this.on('ready', () => this.logger.log('Redis ready'));
    this.on('error', (err: Error) => this.logger.error('Redis error', err.message));
    this.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
