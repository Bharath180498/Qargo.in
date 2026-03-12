import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentActionType } from '@prisma/client';
import Redis from 'ioredis';
import { AgentToolDescriptor } from './agent-types';

@Injectable()
export class AgentPolicyService {
  constructor(private readonly configService: ConfigService) {}

  get isEnabled() {
    const configValue = this.configService.get<boolean>('qargoAi.enabled');
    const rawValue = (
      this.configService.get<string>('QARGO_AI_ENABLED') ??
      process.env.QARGO_AI_ENABLED ??
      ''
    )
      .trim()
      .toLowerCase();

    return Boolean(configValue) || rawValue === 'true';
  }

  get defaultModel() {
    return (this.configService.get<string>('qargoAi.modelDefault') ?? 'gpt-4o-mini').trim();
  }

  get complexModel() {
    return (this.configService.get<string>('qargoAi.modelComplex') ?? 'gpt-4.1').trim();
  }

  get maxToolCallsPerRun() {
    const value = this.configService.get<number>('qargoAi.maxToolCallsPerRun') ?? 8;
    return Math.max(1, Math.min(40, Math.trunc(value)));
  }

  get maxTokensPerRun() {
    const value = this.configService.get<number>('qargoAi.maxTokensPerRun') ?? 4000;
    return Math.max(512, Math.min(32000, Math.trunc(value)));
  }

  get maxRunsPerMinute() {
    const value = this.configService.get<number>('qargoAi.maxRunsPerMinute') ?? 12;
    return Math.max(1, Math.min(120, Math.trunc(value)));
  }

  assertEnabled() {
    if (!this.isEnabled) {
      throw new BadRequestException('QargoAI is disabled. Set QARGO_AI_ENABLED=true to use agent workflows.');
    }
  }

  selectModelForPrompt(prompt: string) {
    const normalizedLength = prompt.trim().length;
    const asksForDeepAnalysis = /\b(deep|detailed|root cause|analyze|investigate|compare)\b/i.test(prompt);

    if (normalizedLength > 700 || asksForDeepAnalysis) {
      return this.complexModel;
    }

    return this.defaultModel;
  }

  async enforceRateLimit(adminUserId: string, redis: Redis) {
    const bucket = Math.floor(Date.now() / 60000);
    const key = `qargo-ai:runs:${adminUserId}:${bucket}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 120);
    }

    if (count > this.maxRunsPerMinute) {
      throw new HttpException(
        `QargoAI rate limit reached (${this.maxRunsPerMinute} runs/min). Please retry shortly.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  requiresConfirmation(tool: AgentToolDescriptor) {
    return tool.actionType === AgentActionType.WRITE;
  }

  assertTokenBudget(totalTokens: number) {
    if (totalTokens > this.maxTokensPerRun) {
      throw new BadRequestException(
        `QargoAI token budget exceeded for this run (${totalTokens}/${this.maxTokensPerRun}).`
      );
    }
  }
}
