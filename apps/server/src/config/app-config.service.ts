import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly config: ConfigService) {
    this.validateRequiredVars();
  }

  private validateRequiredVars(): void {
    const required = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_HOST', 'REDIS_PASSWORD'];
    const missing = required.filter((key) => !this.config.get<string>(key));
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
          `Copy .env.example to .env and fill in the values.`,
      );
    }
    this.logger.log('Configuration validated ✓');
  }

  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return parseInt(this.config.get<string>('PORT', '3001'), 10);
  }

  get clientOrigin(): string {
    return this.config.get<string>('CLIENT_ORIGIN', 'http://localhost:5173');
  }

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get redisHost(): string {
    return this.config.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10);
  }

  get redisPassword(): string {
    return this.config.getOrThrow<string>('REDIS_PASSWORD');
  }

  get jwtSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  get jwtAccessExpiresIn(): string {
    return this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
  }

  get jwtRefreshExpiresIn(): string {
    return this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  get bcryptRounds(): number {
    return parseInt(this.config.get<string>('BCRYPT_ROUNDS', '12'), 10);
  }

  get throttleTtl(): number {
    return parseInt(this.config.get<string>('THROTTLE_TTL_SECONDS', '60'), 10);
  }

  get throttleLimit(): number {
    return parseInt(this.config.get<string>('THROTTLE_LIMIT', '100'), 10);
  }

  get authThrottleTtl(): number {
    return parseInt(this.config.get<string>('AUTH_THROTTLE_TTL_SECONDS', '60'), 10);
  }

  get authThrottleLimit(): number {
    return parseInt(this.config.get<string>('AUTH_THROTTLE_LIMIT', '10'), 10);
  }
}
