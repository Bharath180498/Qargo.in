import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  async check() {
    const checks = {
      database: false,
      redis: false
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      const pong = await this.redisService.getClient().ping();
      checks.redis = pong === 'PONG';
    } catch {
      checks.redis = false;
    }

    return {
      status: checks.database && checks.redis ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      providers: {
        authMode: this.configService.get<string>('authMode') ?? 'mock',
        routeProvider: this.configService.get<string>('routeProvider') ?? 'mock',
        kycProvider: this.configService.get<string>('kycProvider') ?? 'mock',
        pushProvider: this.configService.get<string>('pushProvider') ?? 'mock'
      }
    };
  }
}

