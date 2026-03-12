import { BadRequestException, Injectable } from '@nestjs/common';
import { AgentActionType, AgentRiskLevel, SupportTicketStatus } from '@prisma/client';
import { AdminService } from '../admin/admin.service';
import { SupportService } from '../support/support.service';
import { AgentOpenAiTool, AgentToolContext, AgentToolDescriptor } from './agent-types';

const OPERATIONS_SCOPE = new Set(['active', 'recent', 'all']);
const SUPPORT_STATUS = new Set(Object.values(SupportTicketStatus));
type SupportRequesterRole = 'CUSTOMER' | 'DRIVER';
const SUPPORT_ROLES = new Set<SupportRequesterRole>(['CUSTOMER', 'DRIVER']);

@Injectable()
export class AgentToolRegistryService {
  private readonly tools: AgentToolDescriptor[];

  constructor(
    private readonly adminService: AdminService,
    private readonly supportService: SupportService
  ) {
    this.tools = [
      {
        name: 'operations_summary',
        description: 'Get current operations KPI summary for bookings, rides, support and fleet.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {}
        },
        execute: async () => this.adminService.operationsSummary(),
        summarizeArgs: () => 'Fetch live operations summary'
      },
      {
        name: 'operations_bookings',
        description: 'List operations bookings feed with optional scope and limit filters.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            scope: {
              type: 'string',
              enum: ['active', 'recent', 'all']
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 200
            }
          }
        },
        execute: async (args) =>
          this.adminService.operationsBookings({
            scope: this.parseScope(args.scope),
            limit: this.parseLimit(args.limit, 80)
          }),
        summarizeArgs: (args) =>
          `Bookings scope=${this.parseScope(args.scope) ?? 'active'} limit=${this.parseLimit(args.limit, 80)}`
      },
      {
        name: 'operations_rides',
        description: 'List operations rides feed with optional scope and limit filters.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            scope: {
              type: 'string',
              enum: ['active', 'recent', 'all']
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 200
            }
          }
        },
        execute: async (args) =>
          this.adminService.operationsRides({
            scope: this.parseScope(args.scope),
            limit: this.parseLimit(args.limit, 80)
          }),
        summarizeArgs: (args) =>
          `Rides scope=${this.parseScope(args.scope) ?? 'active'} limit=${this.parseLimit(args.limit, 80)}`
      },
      {
        name: 'operations_order_detail',
        description: 'Get detailed booking/order record by order id.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          required: ['orderId'],
          additionalProperties: false,
          properties: {
            orderId: {
              type: 'string'
            }
          }
        },
        execute: async (args) => {
          const orderId = this.requireString(args.orderId, 'orderId');
          return this.adminService.operationsOrderDetail(orderId);
        },
        summarizeArgs: (args) => `Order detail for ${this.requireString(args.orderId, 'orderId')}`
      },
      {
        name: 'operations_ride_detail',
        description: 'Get detailed ride/trip record by trip id.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          required: ['tripId'],
          additionalProperties: false,
          properties: {
            tripId: {
              type: 'string'
            }
          }
        },
        execute: async (args) => {
          const tripId = this.requireString(args.tripId, 'tripId');
          return this.adminService.operationsRideDetail(tripId);
        },
        summarizeArgs: (args) => `Ride detail for ${this.requireString(args.tripId, 'tripId')}`
      },
      {
        name: 'support_list_tickets',
        description: 'List support tickets with filters for status, role, search, and limit.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: {
              type: 'string',
              enum: Object.values(SupportTicketStatus)
            },
            requesterRole: {
              type: 'string',
              enum: ['CUSTOMER', 'DRIVER']
            },
            search: {
              type: 'string'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 200
            }
          }
        },
        execute: async (args) => {
          const tickets = await this.supportService.listAdminTickets({
            status: this.parseSupportStatus(args.status),
            requesterRole: this.parseSupportRole(args.requesterRole),
            search: this.optionalTrimmedString(args.search),
            limit: this.parseLimit(args.limit, 80)
          });

          const byStatus = tickets.reduce<Record<string, number>>((accumulator, ticket) => {
            accumulator[ticket.status] = (accumulator[ticket.status] ?? 0) + 1;
            return accumulator;
          }, {});

          return {
            total: tickets.length,
            byStatus,
            tickets
          };
        },
        summarizeArgs: (args) => {
          const status = this.parseSupportStatus(args.status) ?? 'ALL';
          const role = this.parseSupportRole(args.requesterRole) ?? 'ALL';
          return `Support tickets status=${status} role=${role} limit=${this.parseLimit(args.limit, 80)}`;
        }
      },
      {
        name: 'support_get_ticket',
        description: 'Get full support ticket thread and details by ticket id.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          required: ['ticketId'],
          additionalProperties: false,
          properties: {
            ticketId: {
              type: 'string'
            }
          }
        },
        execute: async (args) => this.supportService.getAdminTicket(this.requireString(args.ticketId, 'ticketId')),
        summarizeArgs: (args) => `Support ticket detail ${this.requireString(args.ticketId, 'ticketId')}`
      },
      {
        name: 'kyc_list_pending',
        description: 'List pending KYC verifications for admin review.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {}
        },
        execute: async () => this.adminService.pendingKycReview(),
        summarizeArgs: () => 'Fetch pending KYC review queue'
      },
      {
        name: 'kyc_get_detail',
        description: 'Get comprehensive KYC review details for a verification id.',
        actionType: AgentActionType.READ,
        riskLevel: AgentRiskLevel.LOW,
        parameters: {
          type: 'object',
          required: ['verificationId'],
          additionalProperties: false,
          properties: {
            verificationId: {
              type: 'string'
            }
          }
        },
        execute: async (args) => this.adminService.kycReviewDetails(this.requireString(args.verificationId, 'verificationId')),
        summarizeArgs: (args) => `KYC detail ${this.requireString(args.verificationId, 'verificationId')}`
      },
      {
        name: 'support_reply_ticket',
        description: 'Reply to a support ticket as admin.',
        actionType: AgentActionType.WRITE,
        riskLevel: AgentRiskLevel.MEDIUM,
        parameters: {
          type: 'object',
          required: ['ticketId', 'message'],
          additionalProperties: false,
          properties: {
            ticketId: {
              type: 'string'
            },
            message: {
              type: 'string'
            }
          }
        },
        execute: async (args, context: AgentToolContext) =>
          this.supportService.adminReply(this.requireString(args.ticketId, 'ticketId'), context.adminUserId, {
            message: this.requireString(args.message, 'message')
          }),
        summarizeArgs: (args) => {
          const ticketId = this.requireString(args.ticketId, 'ticketId');
          const message = this.requireString(args.message, 'message');
          return `Reply to ticket ${ticketId}: ${message.slice(0, 120)}`;
        }
      },
      {
        name: 'support_update_ticket_status',
        description: 'Update support ticket status as admin.',
        actionType: AgentActionType.WRITE,
        riskLevel: AgentRiskLevel.MEDIUM,
        parameters: {
          type: 'object',
          required: ['ticketId', 'status'],
          additionalProperties: false,
          properties: {
            ticketId: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: Object.values(SupportTicketStatus)
            },
            note: {
              type: 'string'
            }
          }
        },
        execute: async (args, context: AgentToolContext) =>
          this.supportService.adminUpdateStatus(this.requireString(args.ticketId, 'ticketId'), context.adminUserId, {
            status: this.requireSupportStatus(args.status),
            note: this.optionalTrimmedString(args.note)
          }),
        summarizeArgs: (args) => {
          const ticketId = this.requireString(args.ticketId, 'ticketId');
          const status = this.requireSupportStatus(args.status);
          return `Set ticket ${ticketId} to ${status}`;
        }
      },
      {
        name: 'kyc_approve',
        description: 'Approve a pending KYC verification.',
        actionType: AgentActionType.WRITE,
        riskLevel: AgentRiskLevel.HIGH,
        parameters: {
          type: 'object',
          required: ['verificationId'],
          additionalProperties: false,
          properties: {
            verificationId: {
              type: 'string'
            }
          }
        },
        execute: async (args, context: AgentToolContext) =>
          this.adminService.approveKyc(this.requireString(args.verificationId, 'verificationId'), context.adminUserId),
        summarizeArgs: (args) => `Approve KYC verification ${this.requireString(args.verificationId, 'verificationId')}`
      },
      {
        name: 'kyc_reject',
        description: 'Reject a pending KYC verification with reason.',
        actionType: AgentActionType.WRITE,
        riskLevel: AgentRiskLevel.HIGH,
        parameters: {
          type: 'object',
          required: ['verificationId', 'reason'],
          additionalProperties: false,
          properties: {
            verificationId: {
              type: 'string'
            },
            reason: {
              type: 'string'
            }
          }
        },
        execute: async (args, context: AgentToolContext) =>
          this.adminService.rejectKyc(
            this.requireString(args.verificationId, 'verificationId'),
            context.adminUserId,
            this.requireString(args.reason, 'reason')
          ),
        summarizeArgs: (args) => {
          const verificationId = this.requireString(args.verificationId, 'verificationId');
          const reason = this.requireString(args.reason, 'reason');
          return `Reject KYC verification ${verificationId} with reason: ${reason.slice(0, 120)}`;
        }
      }
    ];
  }

  listDescriptors() {
    return this.tools;
  }

  listOpenAiTools(): AgentOpenAiTool[] {
    return this.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  getDescriptor(name: string) {
    return this.tools.find((tool) => tool.name === name);
  }

  private parseScope(value: unknown): 'active' | 'recent' | 'all' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (!OPERATIONS_SCOPE.has(normalized)) {
      throw new BadRequestException(`Invalid scope: ${value}`);
    }

    return normalized as 'active' | 'recent' | 'all';
  }

  private parseSupportStatus(value: unknown): SupportTicketStatus | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    if (!SUPPORT_STATUS.has(normalized as SupportTicketStatus)) {
      throw new BadRequestException(`Invalid support status: ${value}`);
    }

    return normalized as SupportTicketStatus;
  }

  private requireSupportStatus(value: unknown): SupportTicketStatus {
    const parsed = this.parseSupportStatus(value);
    if (!parsed) {
      throw new BadRequestException('status is required');
    }

    return parsed;
  }

  private parseSupportRole(value: unknown): SupportRequesterRole | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    if (!SUPPORT_ROLES.has(normalized as SupportRequesterRole)) {
      throw new BadRequestException(`Invalid requester role: ${value}`);
    }

    return normalized as SupportRequesterRole;
  }

  private parseLimit(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      throw new BadRequestException(`Invalid numeric value: ${value}`);
    }

    const parsed = Math.trunc(numeric);
    if (parsed < 1 || parsed > 200) {
      throw new BadRequestException('limit must be between 1 and 200');
    }

    return parsed;
  }

  private requireString(value: unknown, field: string) {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} is required`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${field} is required`);
    }

    return trimmed;
  }

  private optionalTrimmedString(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }
}
