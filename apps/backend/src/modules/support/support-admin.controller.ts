import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { SupportService } from './support.service';
import { AdminListSupportTicketsQueryDto } from './dto/admin-list-support-tickets-query.dto';
import { AdminReplySupportTicketDto } from './dto/admin-reply-support-ticket.dto';
import { AdminUpdateSupportTicketStatusDto } from './dto/admin-update-support-ticket-status.dto';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@UseGuards(AdminAuthGuard)
@Controller('admin/support')
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  listTickets(@Query() query: AdminListSupportTicketsQueryDto) {
    return this.supportService.listAdminTickets(query);
  }

  @Get('tickets/:ticketId')
  getTicket(@Param('ticketId') ticketId: string) {
    return this.supportService.getAdminTicket(ticketId);
  }

  @Post('tickets/:ticketId/reply')
  reply(
    @Param('ticketId') ticketId: string,
    @Body() payload: AdminReplySupportTicketDto,
    @CurrentUser() user: RequestUser | null
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.supportService.adminReply(ticketId, user.userId, payload);
  }

  @Post('tickets/:ticketId/status')
  updateStatus(
    @Param('ticketId') ticketId: string,
    @Body() payload: AdminUpdateSupportTicketStatusDto,
    @CurrentUser() user: RequestUser | null
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return this.supportService.adminUpdateStatus(ticketId, user.userId, payload);
  }
}
