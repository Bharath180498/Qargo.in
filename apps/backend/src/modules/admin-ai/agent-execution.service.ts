import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentActionStatus, AgentActionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { AgentToolDescriptor } from './agent-types';

@Injectable()
export class AgentExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AgentToolRegistryService
  ) {}

  async executeReadAction(input: {
    runId: string;
    sessionId: string;
    adminUserId: string;
    descriptor: AgentToolDescriptor;
    args: Record<string, unknown>;
  }) {
    try {
      const result = await input.descriptor.execute(input.args, {
        adminUserId: input.adminUserId
      });

      const action = await this.prisma.agentAction.create({
        data: {
          runId: input.runId,
          sessionId: input.sessionId,
          adminUserId: input.adminUserId,
          toolName: input.descriptor.name,
          actionType: AgentActionType.READ,
          status: AgentActionStatus.EXECUTED,
          riskLevel: input.descriptor.riskLevel,
          requiresConfirmation: false,
          argsJson: this.toJsonValue(input.args),
          argsSummary: input.descriptor.summarizeArgs(input.args),
          resultJson: this.toJsonValue(result),
          executedAt: new Date()
        }
      });

      return {
        action,
        result
      };
    } catch (error) {
      await this.prisma.agentAction.create({
        data: {
          runId: input.runId,
          sessionId: input.sessionId,
          adminUserId: input.adminUserId,
          toolName: input.descriptor.name,
          actionType: AgentActionType.READ,
          status: AgentActionStatus.FAILED,
          riskLevel: input.descriptor.riskLevel,
          requiresConfirmation: false,
          argsJson: this.toJsonValue(input.args),
          argsSummary: input.descriptor.summarizeArgs(input.args),
          errorMessage: this.errorMessage(error)
        }
      });

      throw error;
    }
  }

  async proposeWriteAction(input: {
    runId: string;
    sessionId: string;
    adminUserId: string;
    descriptor: AgentToolDescriptor;
    args: Record<string, unknown>;
  }) {
    return this.prisma.agentAction.create({
      data: {
        runId: input.runId,
        sessionId: input.sessionId,
        adminUserId: input.adminUserId,
        toolName: input.descriptor.name,
        actionType: AgentActionType.WRITE,
        status: AgentActionStatus.PROPOSED,
        riskLevel: input.descriptor.riskLevel,
        requiresConfirmation: true,
        argsJson: this.toJsonValue(input.args),
        argsSummary: input.descriptor.summarizeArgs(input.args)
      }
    });
  }

  async confirmAndExecuteAction(actionId: string, adminUserId: string) {
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId }
    });

    if (!action) {
      throw new NotFoundException('Agent action not found');
    }

    if (action.adminUserId !== adminUserId) {
      throw new BadRequestException('You can only confirm your own QargoAI actions');
    }

    if (action.status !== AgentActionStatus.PROPOSED && action.status !== AgentActionStatus.CONFIRMED) {
      throw new BadRequestException(`Action cannot be confirmed in status ${action.status}`);
    }

    const descriptor = this.toolRegistry.getDescriptor(action.toolName);
    if (!descriptor || descriptor.actionType !== AgentActionType.WRITE) {
      throw new BadRequestException(`Write tool is unavailable: ${action.toolName}`);
    }

    const updatedToConfirmed = await this.prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: AgentActionStatus.CONFIRMED,
        confirmedByAdminId: adminUserId,
        confirmedAt: new Date()
      }
    });

    const args = this.parseArgs(updatedToConfirmed.argsJson);

    try {
      const result = await descriptor.execute(args, {
        adminUserId
      });

      return this.prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: AgentActionStatus.EXECUTED,
          resultJson: this.toJsonValue(result),
          executedAt: new Date(),
          errorMessage: null
        }
      });
    } catch (error) {
      return this.prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: AgentActionStatus.FAILED,
          errorMessage: this.errorMessage(error)
        }
      });
    }
  }

  async rejectAction(actionId: string, adminUserId: string, reason?: string) {
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId }
    });

    if (!action) {
      throw new NotFoundException('Agent action not found');
    }

    if (action.adminUserId !== adminUserId) {
      throw new BadRequestException('You can only reject your own QargoAI actions');
    }

    if (action.status !== AgentActionStatus.PROPOSED && action.status !== AgentActionStatus.CONFIRMED) {
      throw new BadRequestException(`Action cannot be rejected in status ${action.status}`);
    }

    return this.prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: AgentActionStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || 'Rejected by admin'
      }
    });
  }

  private parseArgs(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as unknown as Record<string, unknown>;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    if (value === null || value === undefined) {
      return null as unknown as Prisma.InputJsonValue;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown QargoAI execution error';
  }
}
