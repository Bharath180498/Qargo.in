import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MockLoginDto } from './dto/mock-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}

  private get authMode() {
    return this.configService.get<string>('authMode') ?? 'mock';
  }

  private get otpTtlSeconds() {
    return this.configService.get<number>('otp.ttlSeconds') ?? 300;
  }

  private get fixedOtpCode() {
    return this.configService.get<string>('otp.fixedCode') ?? '123456';
  }

  private async issueSession(user: { id: string; role: UserRole }) {
    const token = await this.jwtService.signAsync({
      userId: user.id,
      role: user.role
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        accessToken: token,
        status: AuthSessionStatus.ACTIVE,
        expiresAt
      }
    });

    return {
      token,
      sessionId: session.id,
      expiresAt
    };
  }

  private generateOtpCode() {
    if (this.authMode === 'mock') {
      return this.fixedOtpCode;
    }

    const value = Math.floor(Math.random() * 900000) + 100000;
    return String(value);
  }

  async mockLogin(payload: MockLoginDto) {
    const user = await this.usersService.findOrCreateByPhone(payload);
    const session = await this.issueSession({ id: user.id, role: user.role });

    return {
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      user
    };
  }

  async requestOtp(payload: RequestOtpDto) {
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + this.otpTtlSeconds * 1000);

    await this.prisma.otpSession.updateMany({
      where: {
        phone: payload.phone,
        role: payload.role,
        status: AuthSessionStatus.ACTIVE
      },
      data: {
        status: AuthSessionStatus.EXPIRED
      }
    });

    const otpSession = await this.prisma.otpSession.create({
      data: {
        phone: payload.phone,
        role: payload.role,
        otpCode: code,
        expiresAt
      }
    });

    return {
      otpSessionId: otpSession.id,
      expiresAt,
      // Returned intentionally in fallback mode so app testing works without SMS provider.
      code: this.authMode === 'mock' ? code : undefined
    };
  }

  async verifyOtp(payload: VerifyOtpDto) {
    const session = await this.prisma.otpSession.findFirst({
      where: {
        phone: payload.phone,
        role: payload.role,
        status: AuthSessionStatus.ACTIVE
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!session) {
      throw new UnauthorizedException('OTP session not found');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.otpSession.update({
        where: { id: session.id },
        data: { status: AuthSessionStatus.EXPIRED }
      });
      throw new UnauthorizedException('OTP expired');
    }

    if (session.otpCode !== payload.code) {
      await this.prisma.otpSession.update({
        where: { id: session.id },
        data: { attempts: { increment: 1 } }
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: {
        verifiedAt: new Date(),
        status: AuthSessionStatus.EXPIRED
      }
    });

    const user = await this.usersService.findOrCreateByPhone({
      name: payload.name ?? `${payload.role.toLowerCase()} user`,
      phone: payload.phone,
      role: payload.role
    });

    const authSession = await this.issueSession({ id: user.id, role: user.role });

    if (user.role === UserRole.DRIVER) {
      await this.prisma.driverOnboarding.upsert({
        where: { userId: user.id },
        update: {
          phone: user.phone,
          fullName: user.name
        },
        create: {
          userId: user.id,
          phone: user.phone,
          fullName: user.name
        }
      });
    }

    return {
      token: authSession.token,
      sessionId: authSession.sessionId,
      expiresAt: authSession.expiresAt,
      user
    };
  }

  async logout(token: string) {
    if (!token) {
      return { success: true };
    }

    await this.prisma.authSession.updateMany({
      where: {
        accessToken: token,
        status: AuthSessionStatus.ACTIVE
      },
      data: {
        status: AuthSessionStatus.REVOKED,
        revokedAt: new Date()
      }
    });

    return { success: true };
  }
}
