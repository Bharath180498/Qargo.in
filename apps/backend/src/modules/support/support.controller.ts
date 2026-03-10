import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportService } from './support.service';
import { AddSupportTicketMessageDto } from './dto/add-support-ticket-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportUserQueryDto } from './dto/support-user-query.dto';

@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly configService: ConfigService
  ) {}

  @Get('contact')
  contact() {
    return {
      phone: this.configService.get<string>('supportPhone') ?? '9844259899'
    };
  }

  @Post('tickets')
  createTicket(@Body() payload: CreateSupportTicketDto) {
    return this.supportService.createTicket(payload);
  }

  @Get('tickets')
  listTickets(@Query() query: SupportUserQueryDto) {
    return this.supportService.listTicketsForUser(query.userId);
  }

  @Get('tickets/:ticketId')
  getTicket(@Param('ticketId') ticketId: string, @Query() query: SupportUserQueryDto) {
    return this.supportService.getTicketForUser(ticketId, query.userId);
  }

  @Post('tickets/:ticketId/messages')
  addMessage(@Param('ticketId') ticketId: string, @Body() payload: AddSupportTicketMessageDto) {
    return this.supportService.addUserMessage(ticketId, payload);
  }
}
