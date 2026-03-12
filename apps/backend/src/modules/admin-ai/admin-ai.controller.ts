import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { CreateAgentSessionDto } from './dto/create-agent-session.dto';
import { CreateAgentMessageDto } from './dto/create-agent-message.dto';
import { RejectAgentActionDto } from './dto/reject-agent-action.dto';

@UseGuards(AdminAuthGuard)
@Controller('admin/ai')
export class AdminAiController {
  constructor(private readonly orchestrator: AgentOrchestratorService) {}

  @Post('sessions')
  createSession(@Body() payload: CreateAgentSessionDto, @CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.createSession(user.userId, payload.title);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.listSessions(user.userId);
  }

  @Get('sessions/:sessionId/messages')
  getSessionMessages(@Param('sessionId') sessionId: string, @CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.getSessionMessages(sessionId, user.userId);
  }

  @Post('sessions/:sessionId/messages')
  sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() payload: CreateAgentMessageDto,
    @CurrentUser() user: RequestUser | null
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.sendSessionMessage({
      sessionId,
      adminUserId: user.userId,
      message: payload.message,
      context: payload.context
    });
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string, @CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.getRun(runId, user.userId);
  }

  @Get('metrics')
  getMetrics(@CurrentUser() user: RequestUser | null, @Query('hours') hoursRaw?: string) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    const parsedHours = hoursRaw ? Number(hoursRaw) : 24;
    if (!Number.isFinite(parsedHours) || parsedHours < 1 || parsedHours > 168) {
      throw new BadRequestException('hours must be a number between 1 and 168');
    }

    return this.orchestrator.getMetrics(user.userId, Math.trunc(parsedHours));
  }

  @Post('actions/:actionId/confirm')
  confirmAction(@Param('actionId') actionId: string, @CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.confirmAction(actionId, user.userId);
  }

  @Post('actions/:actionId/reject')
  rejectAction(
    @Param('actionId') actionId: string,
    @Body() payload: RejectAgentActionDto,
    @CurrentUser() user: RequestUser | null
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.orchestrator.rejectAction(actionId, user.userId, payload.reason);
  }
}
