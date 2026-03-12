import { AgentActionType, AgentRiskLevel } from '@prisma/client';

export interface AgentToolContext {
  adminUserId: string;
}

export interface AgentToolDescriptor {
  name: string;
  description: string;
  actionType: AgentActionType;
  riskLevel: AgentRiskLevel;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: AgentToolContext) => Promise<unknown>;
  summarizeArgs: (args: Record<string, unknown>) => string;
}

export interface AgentOpenAiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
