import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentActionStatus,
  AgentActionType,
  AgentMessageRole,
  AgentRiskLevel,
  AgentRunStatus,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AgentExecutionService } from './agent-execution.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly policy: AgentPolicyService,
    private readonly toolRegistry: AgentToolRegistryService,
    private readonly execution: AgentExecutionService
  ) {}

  async createSession(adminUserId: string, title?: string) {
    this.policy.assertEnabled();

    const trimmedTitle = title?.trim();

    return this.prisma.agentSession.create({
      data: {
        adminUserId,
        title: trimmedTitle || `QargoAI Session ${new Date().toLocaleString()}`
      }
    });
  }

  async listSessions(adminUserId: string) {
    this.policy.assertEnabled();

    return this.prisma.agentSession.findMany({
      where: { adminUserId },
      orderBy: {
        lastActiveAt: 'desc'
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            messages: true,
            runs: true
          }
        }
      },
      take: 100
    });
  }

  async getSessionMessages(sessionId: string, adminUserId: string) {
    this.policy.assertEnabled();
    const session = await this.ensureSessionOwnership(sessionId, adminUserId);

    const [messages, runs] = await Promise.all([
      this.prisma.agentMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: 300
      }),
      this.prisma.agentRun.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          actions: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    ]);

    return {
      session,
      messages,
      runs
    };
  }

  async sendSessionMessage(input: {
    sessionId: string;
    adminUserId: string;
    message: string;
    context?: Record<string, unknown>;
  }) {
    this.policy.assertEnabled();
    await this.ensureSessionOwnership(input.sessionId, input.adminUserId);
    await this.policy.enforceRateLimit(input.adminUserId, this.redisService.getClient());

    const messageText = input.message.trim();
    if (!messageText) {
      throw new BadRequestException('Message is required');
    }

    const userMessage = await this.prisma.agentMessage.create({
      data: {
        sessionId: input.sessionId,
        adminUserId: input.adminUserId,
        role: AgentMessageRole.ADMIN,
        content: messageText,
        context: this.toJsonValue(input.context)
      }
    });

    await this.prisma.agentSession.update({
      where: { id: input.sessionId },
      data: {
        lastActiveAt: new Date()
      }
    });

    const model = this.policy.selectModelForPrompt(messageText);
    const run = await this.prisma.agentRun.create({
      data: {
        sessionId: input.sessionId,
        adminUserId: input.adminUserId,
        status: AgentRunStatus.RUNNING,
        model,
        trace: this.toJsonValue({
          inputMessageId: userMessage.id,
          inputContext: input.context ?? null
        })
      }
    });

    await this.processRun({
      runId: run.id,
      sessionId: input.sessionId,
      adminUserId: input.adminUserId,
      model,
      requestContext: input.context,
      adminPrompt: messageText
    });

    return this.getRun(run.id, input.adminUserId);
  }

  async getRun(runId: string, adminUserId: string) {
    this.policy.assertEnabled();

    const run = await this.prisma.agentRun.findFirst({
      where: {
        id: runId,
        adminUserId
      },
      include: {
        actions: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!run) {
      throw new NotFoundException('Agent run not found');
    }

    return {
      ...run,
      proposedActions: run.actions.filter((action) => action.status === AgentActionStatus.PROPOSED)
    };
  }

  async getMetrics(adminUserId: string, hours = 24) {
    this.policy.assertEnabled();

    const boundedHours = Math.max(1, Math.min(168, Math.trunc(hours)));
    const since = new Date(Date.now() - boundedHours * 60 * 60 * 1000);

    const [runCount, proposalCount, confirmedCount, executedCount, rejectedCount, executionFailures, tokenAggregate, runs] =
      await Promise.all([
        this.prisma.agentRun.count({
          where: {
            adminUserId,
            createdAt: {
              gte: since
            }
          }
        }),
        this.prisma.agentAction.count({
          where: {
            adminUserId,
            actionType: AgentActionType.WRITE,
            createdAt: {
              gte: since
            }
          }
        }),
        this.prisma.agentAction.count({
          where: {
            adminUserId,
            actionType: AgentActionType.WRITE,
            confirmedAt: {
              not: null
            },
            createdAt: {
              gte: since
            }
          }
        }),
        this.prisma.agentAction.count({
          where: {
            adminUserId,
            actionType: AgentActionType.WRITE,
            status: AgentActionStatus.EXECUTED,
            createdAt: {
              gte: since
            }
          }
        }),
        this.prisma.agentAction.count({
          where: {
            adminUserId,
            actionType: AgentActionType.WRITE,
            status: AgentActionStatus.REJECTED,
            createdAt: {
              gte: since
            }
          }
        }),
        this.prisma.agentAction.count({
          where: {
            adminUserId,
            actionType: AgentActionType.WRITE,
            status: AgentActionStatus.FAILED,
            createdAt: {
              gte: since
            }
          }
        }),
        this.prisma.agentRun.aggregate({
          where: {
            adminUserId,
            createdAt: {
              gte: since
            }
          },
          _sum: {
            totalTokens: true
          },
          _avg: {
            totalTokens: true
          }
        }),
        this.prisma.agentRun.findMany({
          where: {
            adminUserId,
            createdAt: {
              gte: since
            },
            completedAt: {
              not: null
            }
          },
          select: {
            createdAt: true,
            completedAt: true
          },
          take: 500
        })
      ]);

    const latencySamples = runs
      .map((run) => {
        if (!run.completedAt) {
          return null;
        }
        return Math.max(0, run.completedAt.getTime() - run.createdAt.getTime());
      })
      .filter((value): value is number => value !== null);

    const avgRunLatencyMs =
      latencySamples.length > 0
        ? Math.round(latencySamples.reduce((total, value) => total + value, 0) / latencySamples.length)
        : 0;

    const confirmRate = proposalCount > 0 ? Number((confirmedCount / proposalCount).toFixed(4)) : 0;
    const executionFailureRate = confirmedCount > 0 ? Number((executionFailures / confirmedCount).toFixed(4)) : 0;

    return {
      windowHours: boundedHours,
      since,
      runCount,
      proposalCount,
      confirmedCount,
      executedCount,
      rejectedCount,
      executionFailures,
      confirmRate,
      executionFailureRate,
      avgRunLatencyMs,
      avgRunLatencySeconds: Number((avgRunLatencyMs / 1000).toFixed(2)),
      tokenUsageTotal: tokenAggregate._sum.totalTokens ?? 0,
      tokenUsageAvgPerRun: Math.round(tokenAggregate._avg.totalTokens ?? 0)
    };
  }

  async confirmAction(actionId: string, adminUserId: string) {
    this.policy.assertEnabled();

    const action = await this.execution.confirmAndExecuteAction(actionId, adminUserId);

    await this.appendAssistantMessageForAction(action.id);
    await this.refreshRunStatusAfterAction(action.runId);

    return {
      action,
      run: await this.getRun(action.runId, adminUserId)
    };
  }

  async rejectAction(actionId: string, adminUserId: string, reason?: string) {
    this.policy.assertEnabled();

    const action = await this.execution.rejectAction(actionId, adminUserId, reason);

    await this.appendAssistantMessageForAction(action.id);
    await this.refreshRunStatusAfterAction(action.runId);

    return {
      action,
      run: await this.getRun(action.runId, adminUserId)
    };
  }

  private async processRun(input: {
    runId: string;
    sessionId: string;
    adminUserId: string;
    model: string;
    requestContext?: Record<string, unknown>;
    adminPrompt: string;
  }) {
    const traceSteps: Array<Record<string, unknown>> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let toolCallsCount = 0;

    try {
      const history = await this.prisma.agentMessage.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: 'desc' },
        take: 24
      });

      const historyAsc = history.reverse();
      const conversation: OpenAiChatMessage[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(input.requestContext)
        }
      ];

      for (const message of historyAsc) {
        if (message.role === AgentMessageRole.ADMIN) {
          conversation.push({
            role: 'user',
            content: message.content
          });
          continue;
        }

        if (message.role === AgentMessageRole.ASSISTANT) {
          conversation.push({
            role: 'assistant',
            content: message.content
          });
          continue;
        }

        if (message.role === AgentMessageRole.SYSTEM) {
          conversation.push({
            role: 'system',
            content: message.content
          });
        }
      }

      const openAiTools = this.toolRegistry.listOpenAiTools();
      const maxToolCalls = this.policy.maxToolCallsPerRun;

      while (toolCallsCount < maxToolCalls) {
        const response = await this.requestOpenAi({
          model: input.model,
          messages: conversation,
          tools: openAiTools,
          maxTokens: Math.min(1200, this.policy.maxTokensPerRun)
        });

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        const currentTotalTokens = response.usage?.total_tokens ?? promptTokens + completionTokens;

        totalPromptTokens += promptTokens;
        totalCompletionTokens += completionTokens;
        totalTokens += currentTotalTokens;

        this.policy.assertTokenBudget(totalTokens);

        const choice = response.choices?.[0]?.message;
        if (!choice) {
          throw new BadRequestException('QargoAI returned an empty response');
        }

        const assistantContent = (choice.content ?? '').trim();
        const toolCalls = choice.tool_calls ?? [];

        traceSteps.push({
          assistantContent,
          toolCalls: toolCalls.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.function?.name ?? 'unknown'
          })),
          usage: {
            promptTokens,
            completionTokens,
            currentTotalTokens
          }
        });

        if (toolCalls.length === 0) {
          let finalText = assistantContent || 'Completed.';

          if (toolCallsCount > 0) {
            const synthesized = await this.synthesizeReadableAnswer({
              model: input.model,
              adminPrompt: input.adminPrompt,
              draftAnswer: finalText
            });

            totalPromptTokens += synthesized.promptTokens;
            totalCompletionTokens += synthesized.completionTokens;
            totalTokens += synthesized.totalTokens;
            this.policy.assertTokenBudget(totalTokens);

            if (synthesized.content) {
              finalText = synthesized.content;
            }

            traceSteps.push({
              stage: 'synthesis',
              usage: {
                promptTokens: synthesized.promptTokens,
                completionTokens: synthesized.completionTokens,
                currentTotalTokens: synthesized.totalTokens
              }
            });
          }

          await this.prisma.agentMessage.create({
            data: {
              sessionId: input.sessionId,
              runId: input.runId,
              role: AgentMessageRole.ASSISTANT,
              content: finalText
            }
          });

          await this.prisma.agentSession.update({
            where: { id: input.sessionId },
            data: {
              lastActiveAt: new Date()
            }
          });

          await this.prisma.agentRun.update({
            where: { id: input.runId },
            data: {
              status: AgentRunStatus.COMPLETED,
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
              totalTokens,
              toolCallsCount,
              completedAt: new Date(),
              trace: this.toJsonValue({
                context: input.requestContext ?? null,
                steps: traceSteps
              })
            }
          });

          return;
        }

        const assistantForConversation: OpenAiChatMessage = {
          role: 'assistant',
          content: assistantContent,
          tool_calls: toolCalls
        };
        conversation.push(assistantForConversation);

        const proposedWriteActions: Array<{ id: string; summary: string; toolName: string; riskLevel: string }> = [];

        for (const toolCall of toolCalls) {
          if (toolCallsCount >= maxToolCalls) {
            break;
          }

          toolCallsCount += 1;

          const toolName = toolCall.function?.name?.trim();
          const args = this.parseToolArgs(toolCall.function?.arguments ?? '{}');
          const descriptor = toolName ? this.toolRegistry.getDescriptor(toolName) : undefined;

          if (!descriptor) {
            const errorMessage = `Tool is not allowed: ${toolName ?? 'unknown'}`;

            await this.prisma.agentAction.create({
              data: {
                runId: input.runId,
                sessionId: input.sessionId,
                adminUserId: input.adminUserId,
                toolName: toolName ?? 'unknown_tool',
                actionType: AgentActionType.READ,
                status: AgentActionStatus.FAILED,
                riskLevel: AgentRiskLevel.HIGH,
                requiresConfirmation: false,
                argsJson: this.toJsonValue(args),
                argsSummary: `Rejected unknown tool call ${toolName ?? 'unknown'}`,
                errorMessage
              }
            });

            conversation.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: errorMessage })
            });
            continue;
          }

          if (this.policy.requiresConfirmation(descriptor)) {
            const proposed = await this.execution.proposeWriteAction({
              runId: input.runId,
              sessionId: input.sessionId,
              adminUserId: input.adminUserId,
              descriptor,
              args
            });

            proposedWriteActions.push({
              id: proposed.id,
              summary: proposed.argsSummary ?? descriptor.summarizeArgs(args),
              toolName: descriptor.name,
              riskLevel: proposed.riskLevel
            });
            continue;
          }

          try {
            const readResult = await this.execution.executeReadAction({
              runId: input.runId,
              sessionId: input.sessionId,
              adminUserId: input.adminUserId,
              descriptor,
              args
            });

            conversation.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: this.serializeToolResult(readResult.result)
            });
          } catch (error) {
            conversation.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: this.errorMessage(error)
              })
            });
          }
        }

        if (proposedWriteActions.length > 0) {
          const proposalLines = proposedWriteActions.map(
            (proposal, index) =>
              `${index + 1}. [${proposal.riskLevel}] ${proposal.toolName} -> ${proposal.summary} (actionId=${proposal.id})`
          );

          const content = [
            assistantContent,
            'I prepared the following write actions. Confirm or reject each action card to continue:',
            ...proposalLines
          ]
            .filter((line) => line && line.trim())
            .join('\n\n');

          await this.prisma.agentMessage.create({
            data: {
              sessionId: input.sessionId,
              runId: input.runId,
              role: AgentMessageRole.ASSISTANT,
              content
            }
          });

          await this.prisma.agentRun.update({
            where: { id: input.runId },
            data: {
              status: AgentRunStatus.WAITING_CONFIRMATION,
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
              totalTokens,
              toolCallsCount,
              trace: this.toJsonValue({
                context: input.requestContext ?? null,
                steps: traceSteps
              })
            }
          });

          await this.prisma.agentSession.update({
            where: { id: input.sessionId },
            data: {
              lastActiveAt: new Date()
            }
          });

          return;
        }
      }

      await this.prisma.agentMessage.create({
        data: {
          sessionId: input.sessionId,
          runId: input.runId,
          role: AgentMessageRole.ASSISTANT,
          content: `Stopped after reaching tool-call limit (${this.policy.maxToolCallsPerRun}). Refine the request and retry.`
        }
      });

      await this.prisma.agentRun.update({
        where: { id: input.runId },
        data: {
          status: AgentRunStatus.FAILED,
          errorMessage: `Tool-call limit reached (${this.policy.maxToolCallsPerRun})`,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens,
          toolCallsCount,
          completedAt: new Date(),
          trace: this.toJsonValue({
            context: input.requestContext ?? null,
            steps: traceSteps
          })
        }
      });
    } catch (error) {
      await this.prisma.agentMessage.create({
        data: {
          sessionId: input.sessionId,
          runId: input.runId,
          role: AgentMessageRole.SYSTEM,
          content: `QargoAI run failed: ${this.errorMessage(error)}`
        }
      });

      await this.prisma.agentRun.update({
        where: { id: input.runId },
        data: {
          status: AgentRunStatus.FAILED,
          errorMessage: this.errorMessage(error),
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens,
          toolCallsCount,
          completedAt: new Date(),
          trace: this.toJsonValue({
            context: input.requestContext ?? null,
            steps: traceSteps
          })
        }
      });
    }
  }

  private async appendAssistantMessageForAction(actionId: string) {
    const action = await this.prisma.agentAction.findUnique({
      where: { id: actionId }
    });

    if (!action) {
      return;
    }

    let content = `Action ${action.id} ${action.status}.`;

    if (action.status === AgentActionStatus.EXECUTED) {
      content = `Action executed: ${action.toolName} (${action.argsSummary ?? 'completed'}).`;
    }

    if (action.status === AgentActionStatus.REJECTED) {
      content = `Action rejected: ${action.toolName}. ${action.rejectionReason ?? ''}`.trim();
    }

    if (action.status === AgentActionStatus.FAILED) {
      content = `Action failed: ${action.toolName}. ${action.errorMessage ?? ''}`.trim();
    }

    await this.prisma.agentMessage.create({
      data: {
        sessionId: action.sessionId,
        runId: action.runId,
        role: AgentMessageRole.ASSISTANT,
        content
      }
    });

    await this.prisma.agentSession.update({
      where: { id: action.sessionId },
      data: {
        lastActiveAt: new Date()
      }
    });
  }

  private async refreshRunStatusAfterAction(runId: string) {
    const pending = await this.prisma.agentAction.count({
      where: {
        runId,
        status: {
          in: [AgentActionStatus.PROPOSED, AgentActionStatus.CONFIRMED]
        }
      }
    });

    if (pending > 0) {
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: AgentRunStatus.WAITING_CONFIRMATION
        }
      });
      return;
    }

    const failedActions = await this.prisma.agentAction.count({
      where: {
        runId,
        status: AgentActionStatus.FAILED
      }
    });

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: failedActions > 0 ? AgentRunStatus.FAILED : AgentRunStatus.COMPLETED,
        completedAt: new Date()
      }
    });
  }

  private async ensureSessionOwnership(sessionId: string, adminUserId: string) {
    const session = await this.prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        adminUserId
      }
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    return session;
  }

  private buildSystemPrompt(requestContext?: Record<string, unknown>) {
    const contextBlock = requestContext
      ? `\n\nActive admin page context (JSON):\n${JSON.stringify(requestContext, null, 2)}`
      : '';

    return [
      'You are QargoAI, an admin operations copilot for Qargo.',
      'Always use available tools to fetch live data before answering operational questions.',
      'Never use unknown tools. Never invent ids.',
      'For write operations: propose exact tool calls only. Admin confirmation is required before execution.',
      'Never claim a write action completed unless the execution record status is EXECUTED.',
      'Give an executive answer first, then concise findings. Do not dump raw JSON or internal traces.',
      'If the request asks for "all" records, report totals and key patterns first, then include representative rows.',
      'Only include raw IDs when they are necessary for follow-up actions.',
      contextBlock
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSynthesisPrompt() {
    return [
      'You are QargoAI Response Composer.',
      'Rewrite the draft response to sound clear, concise, and helpful like a strong assistant.',
      'Output format:',
      '1) Direct answer (1-2 lines)',
      '2) Key findings (2-6 bullets)',
      '3) Suggested next action (only if useful)',
      'Do not mention tools, tool-calls, traces, or internal mechanics.',
      'Avoid raw dumps. Summarize with business clarity.',
      'If user asked for "all", include count and state if list is partial/truncated.',
      'Never claim a write action was completed unless explicitly stated in the draft.'
    ].join('\n');
  }

  private async synthesizeReadableAnswer(input: {
    model: string;
    adminPrompt: string;
    draftAnswer: string;
  }) {
    try {
      const response = await this.requestOpenAi({
        model: input.model,
        messages: [
          {
            role: 'system',
            content: this.buildSynthesisPrompt()
          },
          {
            role: 'user',
            content: [
              `Admin request:\n${input.adminPrompt}`,
              `Draft response:\n${input.draftAnswer}`
            ].join('\n\n')
          }
        ],
        maxTokens: Math.min(900, this.policy.maxTokensPerRun)
      });

      const choice = response.choices?.[0]?.message;
      const content = (choice?.content ?? '').trim();
      const promptTokens = response.usage?.prompt_tokens ?? 0;
      const completionTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = response.usage?.total_tokens ?? promptTokens + completionTokens;

      return {
        content,
        promptTokens,
        completionTokens,
        totalTokens
      };
    } catch {
      return {
        content: input.draftAnswer,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    }
  }

  private parseToolArgs(rawArguments: string): Record<string, unknown> {
    const trimmed = rawArguments?.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private serializeToolResult(value: unknown) {
    try {
      const serialized = JSON.stringify(value);
      if (!serialized) {
        return '{}';
      }

      if (serialized.length > 12000) {
        return `${serialized.slice(0, 12000)}...<truncated>`;
      }

      return serialized;
    } catch {
      return JSON.stringify({ error: 'Failed to serialize tool output' });
    }
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

    return 'Unknown QargoAI error';
  }

  private async requestOpenAi(input: {
    model: string;
    messages: OpenAiChatMessage[];
    tools?: unknown[];
    maxTokens: number;
  }): Promise<OpenAiChatResponse> {
    const apiKey = (this.configService.get<string>('qargoAi.openAiApiKey') ?? '').trim();

    if (!apiKey) {
      throw new BadRequestException('OPENAI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const requestBody: Record<string, unknown> = {
        model: input.model,
        temperature: 0.2,
        max_tokens: input.maxTokens,
        messages: input.messages
      };

      if (input.tools && input.tools.length > 0) {
        requestBody.tool_choice = 'auto';
        requestBody.tools = input.tools;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      const parsed = (await response.json().catch(() => ({}))) as OpenAiChatResponse;

      if (!response.ok) {
        const reason = parsed.error?.message ?? `OpenAI request failed (${response.status})`;
        throw new BadRequestException(reason);
      }

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }
}
