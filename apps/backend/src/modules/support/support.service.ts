import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { GenerateSupportMessageUploadUrlDto } from './dto/generate-support-message-upload-url.dto';
import { SupportMessageAttachmentDto } from './dto/support-message-attachment.dto';
import { buildS3UploadUrl } from '../../common/utils/s3-upload.util';

@Injectable()
export class SupportService {
  private static readonly MAX_MESSAGE_ATTACHMENTS = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

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

  private buildSafeFileName(fileName: string) {
    const trimmed = fileName.trim();
    if (!trimmed) {
      return `support-attachment-${Date.now()}.jpg`;
    }

    const normalized = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
    return normalized.slice(-120) || `support-attachment-${Date.now()}.jpg`;
  }

  private get supportTranslationEnabled() {
    return this.configService.get<boolean>('supportTranslation.enabled') ?? false;
  }

  private get supportTranslationTargetLanguage() {
    return (this.configService.get<string>('supportTranslation.targetLanguage') ?? 'en')
      .trim()
      .toLowerCase();
  }

  private get supportTranslationApiKey() {
    return this.configService.get<string>('supportTranslation.googleApiKey') ?? '';
  }

  private get supportTranslationApiUrl() {
    return this.configService.get<string>('supportTranslation.googleApiUrl') ?? '';
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private async translateTextForSupport(text: string): Promise<{
    sourceLanguage?: string;
    translatedEnglish?: string;
    translationProvider?: string;
  }> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {};
    }

    if (!this.supportTranslationEnabled) {
      return {};
    }

    const apiKey = this.supportTranslationApiKey.trim();
    const apiUrl = this.supportTranslationApiUrl.trim();
    if (!apiKey || !apiUrl) {
      return {};
    }

    try {
      const targetLanguage = this.supportTranslationTargetLanguage || 'en';
      const body = new URLSearchParams();
      body.set('q', trimmed);
      body.set('target', targetLanguage);
      body.set('format', 'text');

      const separator = apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${apiUrl}${separator}key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: body.toString()
      });

      if (!response.ok) {
        return {};
      }

      const parsed = (await response.json()) as {
        data?: {
          translations?: Array<{
            translatedText?: string;
            detectedSourceLanguage?: string;
          }>;
        };
      };

      const first = parsed.data?.translations?.[0];
      const translatedRaw =
        typeof first?.translatedText === 'string' ? this.decodeHtmlEntities(first.translatedText).trim() : '';
      const sourceLanguage =
        typeof first?.detectedSourceLanguage === 'string'
          ? first.detectedSourceLanguage.trim().toLowerCase()
          : undefined;

      if (!translatedRaw) {
        return {
          sourceLanguage
        };
      }

      const sameAsInput = translatedRaw.toLowerCase() === trimmed.toLowerCase();
      if (sameAsInput) {
        return {
          sourceLanguage
        };
      }

      return {
        sourceLanguage,
        translatedEnglish: translatedRaw,
        translationProvider: 'google-translate-v2'
      };
    } catch {
      return {};
    }
  }

  private normalizeAttachmentPayload(attachments?: SupportMessageAttachmentDto[]) {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    if (attachments.length > SupportService.MAX_MESSAGE_ATTACHMENTS) {
      throw new BadRequestException(
        `A message can include up to ${SupportService.MAX_MESSAGE_ATTACHMENTS} attachments`
      );
    }

    return attachments.map((attachment) => {
      const fileKey = attachment.fileKey.trim();
      const fileUrl = attachment.fileUrl.trim();
      const fileName = attachment.fileName?.trim() || undefined;
      const contentType = attachment.contentType?.trim().toLowerCase() || undefined;

      if (!fileKey || !fileUrl) {
        throw new BadRequestException('Attachment file metadata is required');
      }

      if (contentType && !contentType.startsWith('image/')) {
        throw new BadRequestException('Only image attachments are supported in support chat');
      }

      return {
        fileKey,
        fileUrl,
        fileName,
        contentType,
        fileSizeBytes: attachment.fileSizeBytes
      } satisfies Prisma.SupportTicketMessageAttachmentCreateWithoutMessageInput;
    });
  }

  private async getUserTicketOrThrow(ticketId: string, userId: string) {
    const requester = await this.getRequester(userId);

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

    return { requester, ticket };
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
          attachments: {
            orderBy: {
              createdAt: 'asc' as const
            }
          },
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
    const messageAttachments = this.normalizeAttachmentPayload(payload.attachments);
    const descriptionMessage = payload.description.trim();

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
    const descriptionTranslation = await this.translateTextForSupport(descriptionMessage);

    return this.prisma.supportTicket.create({
      data: {
        requesterUserId: requester.id,
        requesterRole: requester.role,
        orderId,
        tripId,
        subject: payload.subject.trim(),
        description: descriptionMessage,
        descriptionSourceLanguage: descriptionTranslation.sourceLanguage,
        descriptionTranslatedEnglish: descriptionTranslation.translatedEnglish,
        descriptionTranslationProvider: descriptionTranslation.translationProvider,
        messages: {
          create: {
            senderType: messageType,
            senderUserId: requester.id,
            message: descriptionMessage,
            sourceLanguage: descriptionTranslation.sourceLanguage,
            translatedEnglish: descriptionTranslation.translatedEnglish,
            translationProvider: descriptionTranslation.translationProvider,
            ...(messageAttachments.length > 0
              ? {
                  attachments: {
                    create: messageAttachments
                  }
                }
              : {})
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

  async generateMessageAttachmentUploadUrl(
    ticketId: string,
    payload: GenerateSupportMessageUploadUrlDto
  ) {
    const { requester, ticket } = await this.getUserTicketOrThrow(ticketId, payload.userId);

    const normalizedContentType = payload.contentType?.trim().toLowerCase() || 'image/jpeg';
    if (!normalizedContentType.startsWith('image/')) {
      throw new BadRequestException('Support attachment must be an image');
    }

    const safeFileName = this.buildSafeFileName(payload.fileName);
    const fileKey = `support/${ticket.id}/${requester.id}/msg-${Date.now()}-${safeFileName}`;
    const endpoint = (this.configService.get<string>('s3.endpoint') ?? '').trim();
    const accessKeyId = (this.configService.get<string>('s3.accessKeyId') ?? '').trim();
    const secretAccessKey = (this.configService.get<string>('s3.secretAccessKey') ?? '').trim();
    const bucket = (this.configService.get<string>('s3.bucket') ?? '').trim();
    const region = this.configService.get<string>('s3.region') ?? 'auto';
    const signedUpload = await buildS3UploadUrl(
      {
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey
      },
      {
        fileKey,
        contentType: normalizedContentType
      }
    );

    if (!signedUpload) {
      return {
        fileKey,
        uploadUrl: `mock://upload/${fileKey}`,
        fileUrl: `https://mock-storage.local/${fileKey}`,
        contentType: normalizedContentType,
        mode: 'mock-storage'
      };
    }

    return {
      fileKey,
      uploadUrl: signedUpload.uploadUrl,
      fileUrl: signedUpload.fileUrl,
      contentType: normalizedContentType,
      mode: signedUpload.mode
    };
  }

  async addUserMessage(ticketId: string, payload: AddSupportTicketMessageDto) {
    const { requester, ticket } = await this.getUserTicketOrThrow(ticketId, payload.userId);
    const attachments = this.normalizeAttachmentPayload(payload.attachments);
    const messageText = payload.message.trim();
    const messageTranslation = await this.translateTextForSupport(messageText);

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
          message: messageText,
          sourceLanguage: messageTranslation.sourceLanguage,
          translatedEnglish: messageTranslation.translatedEnglish,
          translationProvider: messageTranslation.translationProvider,
          ...(attachments.length > 0
            ? {
                attachments: {
                  create: attachments
                }
              }
            : {})
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
              { descriptionTranslatedEnglish: { contains: search, mode: 'insensitive' } },
              { requesterUser: { name: { contains: search, mode: 'insensitive' } } },
              { requesterUser: { phone: { contains: search } } },
              {
                messages: {
                  some: {
                    OR: [
                      { message: { contains: search, mode: 'insensitive' } },
                      { translatedEnglish: { contains: search, mode: 'insensitive' } }
                    ]
                  }
                }
              },
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
            attachments: {
              orderBy: {
                createdAt: 'asc'
              }
            },
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
