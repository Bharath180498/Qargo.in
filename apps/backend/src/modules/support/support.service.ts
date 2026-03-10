import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SupportMessageSenderType,
  SupportTicketStatus,
  UserRole
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddSupportTicketMessageDto } from './dto/add-support-ticket-message.dto';
import { AdminListSupportTicketsQueryDto } from './dto/admin-list-support-tickets-query.dto';
import { AdminReplySupportTicketDto } from './dto/admin-reply-support-ticket.dto';
import { AdminUpdateSupportTicketStatusDto } from './dto/admin-update-support-ticket-status.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRequester(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: {
          select: { id: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureOrderAccess(input: {
    requesterId: string;
    requesterRole: UserRole;
    requesterDriverId?: string;
    orderId: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        trip: {
          select: {
            id: true,
            driverId: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (input.requesterRole === UserRole.CUSTOMER && order.customerId !== input.requesterId) {
      throw new ForbiddenException('You can only raise support for your own booking');
    }

    if (input.requesterRole === UserRole.DRIVER) {
      if (!input.requesterDriverId) {
        throw new ForbiddenException('Driver profile not found');
      }

      if (!order.trip || order.trip.driverId !== input.requesterDriverId) {
        throw new ForbiddenException('You can only raise support for your assigned ride');
      }
    }

    return order;
  }

  private async ensureTripAccess(input: {
    requesterId: string;
    requesterRole: UserRole;
    requesterDriverId?: string;
    tripId: string;
  }) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: input.tripId },
      include: {
        order: {
          select: {
            id: true,
            customerId: true
          }
        }
      }
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (input.requesterRole === UserRole.CUSTOMER && trip.order.customerId !== input.requesterId) {
      throw new ForbiddenException('You can only raise support for your own trip');
    }

    if (input.requesterRole === UserRole.DRIVER) {
      if (!input.requesterDriverId) {
        throw new ForbiddenException('Driver profile not found');
      }

      if (trip.driverId !== input.requesterDriverId) {
        throw new ForbiddenException('You can only raise support for your assigned trip');
      }
    }

    return trip;
  }

  private detailInclude() {
    return {
      requesterUser: {
        select: {
          id: true,
          name: true,
          phone: true,
          role: true
        }
      },
      order: {
        select: {
          id: true,
          status: true,
          pickupAddress: true,
          dropAddress: true,
          createdAt: true,
          updatedAt: true
        }
      },
      trip: {
        select: {
          id: true,
          status: true,
          driverId: true,
          createdAt: true,
          updatedAt: true
        }
      },
      messages: {
        orderBy: {
          createdAt: 'asc' as const
        },
        include: {
          senderUser: {
            select: {
              id: true,
              name: true,
              phone: true,
              role: true
            }
          }
        }
      }
    } satisfies Prisma.SupportTicketInclude;
  }

  async createTicket(payload: CreateSupportTicketDto) {
    const requester = await this.getRequester(payload.userId);
    const requesterDriverId = requester.driverProfile?.id;

    let orderId = payload.orderId?.trim() || undefined;
    let tripId = payload.tripId?.trim() || undefined;

    if (tripId) {
      const trip = await this.ensureTripAccess({
        requesterId: requester.id,
        requesterRole: requester.role,
        requesterDriverId,
        tripId
      });

      if (!orderId) {
        orderId = trip.orderId;
      }
    }

    if (orderId) {
      const order = await this.ensureOrderAccess({
        requesterId: requester.id,
        requesterRole: requester.role,
        requesterDriverId,
        orderId
      });

      if (!tripId && order.trip?.id) {
        tripId = order.trip.id;
      }
    }

    const messageType = requester.role === UserRole.ADMIN ? SupportMessageSenderType.ADMIN : SupportMessageSenderType.USER;

    return this.prisma.supportTicket.create({
      data: {
        requesterUserId: requester.id,
        requesterRole: requester.role,
        orderId,
        tripId,
        subject: payload.subject.trim(),
        description: payload.description.trim(),
        messages: {
          create: {
            senderType: messageType,
            senderUserId: requester.id,
            message: payload.description.trim()
          }
        }
      },
      include: this.detailInclude()
    });
  }

  async listTicketsForUser(userId: string) {
    await this.getRequester(userId);

    return this.prisma.supportTicket.findMany({
      where: {
        requesterUserId: userId
      },
      include: this.detailInclude(),
      orderBy: {
        updatedAt: 'desc'
      },
      take: 100
    });
  }

  async getTicketForUser(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: this.detailInclude()
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    if (ticket.requesterUserId !== userId) {
      throw new ForbiddenException('You do not have access to this support ticket');
    }

    return ticket;
  }

  async addUserMessage(ticketId: string, payload: AddSupportTicketMessageDto) {
    const requester = await this.getRequester(payload.userId);

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        requesterUserId: true,
        status: true
      }
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    if (ticket.requesterUserId !== requester.id) {
      throw new ForbiddenException('You do not have access to this support ticket');
    }

    const nextStatus =
      ticket.status === SupportTicketStatus.RESOLVED ||
      ticket.status === SupportTicketStatus.WAITING_FOR_USER
        ? SupportTicketStatus.IN_PROGRESS
        : ticket.status;

    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: SupportMessageSenderType.USER,
          senderUserId: requester.id,
          message: payload.message.trim()
        }
      }),
      this.prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          resolvedAt: null
        }
      })
    ]);

    return this.prisma.supportTicket.findUnique({
      where: { id: ticket.id },
      include: this.detailInclude()
    });
  }

  async listAdminTickets(query: AdminListSupportTicketsQueryDto) {
    const limit = query.limit ?? 80;
    const search = query.search?.trim();

    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.requesterRole ? { requesterRole: query.requesterRole } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { requesterUser: { name: { contains: search, mode: 'insensitive' } } },
              { requesterUser: { phone: { contains: search } } },
              { orderId: search },
              { tripId: search }
            ]
          }
        : {})
    };

    return this.prisma.supportTicket.findMany({
      where,
      include: {
        requesterUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true
          }
        },
        order: {
          select: {
            id: true,
            status: true,
            pickupAddress: true,
            dropAddress: true
          }
        },
        trip: {
          select: {
            id: true,
            status: true,
            driverId: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            senderUser: {
              select: {
                id: true,
                name: true,
                phone: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: limit
    });
  }

  async getAdminTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: this.detailInclude()
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return ticket;
  }

  async adminReply(ticketId: string, adminUserId: string, payload: AdminReplySupportTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true
      }
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderType: SupportMessageSenderType.ADMIN,
          senderUserId: adminUserId,
          message: payload.message.trim()
        }
      }),
      this.prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: SupportTicketStatus.WAITING_FOR_USER,
          resolvedAt: null
        }
      })
    ]);

    return this.getAdminTicket(ticket.id);
  }

  async adminUpdateStatus(
    ticketId: string,
    adminUserId: string,
    payload: AdminUpdateSupportTicketStatusDto
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true
      }
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const statusChanged = ticket.status !== payload.status;
    const note = payload.note?.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: payload.status,
          resolvedAt: payload.status === SupportTicketStatus.RESOLVED ? new Date() : null
        }
      });

      if (statusChanged || note) {
        const statusMessage = statusChanged ? `Status updated to ${payload.status}` : 'Admin note';
        const message = note ? `${statusMessage}: ${note}` : statusMessage;

        await tx.supportTicketMessage.create({
          data: {
            ticketId: ticket.id,
            senderType: SupportMessageSenderType.SYSTEM,
            senderUserId: adminUserId,
            message
          }
        });
      }
    });

    return this.getAdminTicket(ticket.id);
  }
}
