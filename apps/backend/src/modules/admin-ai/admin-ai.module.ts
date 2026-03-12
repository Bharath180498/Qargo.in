import { Module } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { SupportModule } from '../support/support.module';
import { AdminAiController } from './admin-ai.controller';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentExecutionService } from './agent-execution.service';

@Module({
  imports: [AuthModule, AdminModule, SupportModule],
  controllers: [AdminAiController],
  providers: [
    AgentOrchestratorService,
    AgentToolRegistryService,
    AgentPolicyService,
    AgentExecutionService,
    AdminAuthGuard
  ]
})
export class AdminAiModule {}
