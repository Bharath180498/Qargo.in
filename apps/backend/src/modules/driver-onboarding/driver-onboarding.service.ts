import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpsertDriverProfileDto } from './dto/upsert-profile.dto';
import { UpsertDriverVehicleDto } from './dto/upsert-vehicle.dto';
import { UpsertDriverBankDto } from './dto/upsert-bank.dto';

@Injectable()
export class DriverOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { onboarding: true, driverProfile: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureOnboarding(userId: string) {
    const user = await this.ensureUser(userId);
    if (user.onboarding) {
      return user.onboarding;
    }

    return this.prisma.driverOnboarding.create({
      data: {
        userId,
        fullName: user.name,
        phone: user.phone,
        email: user.email,
        status: OnboardingStatus.IN_PROGRESS
      }
    });
  }

  async me(userId: string) {
    const user = await this.ensureUser(userId);

    return this.prisma.driverOnboarding.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        fullName: user.name,
        phone: user.phone,
        email: user.email,
        status: OnboardingStatus.IN_PROGRESS
      },
      include: {
        documents: true,
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
  }

  async upsertProfile(payload: UpsertDriverProfileDto) {
    await this.ensureUser(payload.userId);
    const onboarding = await this.ensureOnboarding(payload.userId);

    return this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: {
        fullName: payload.fullName ?? onboarding.fullName,
        phone: payload.phone ?? onboarding.phone,
        email: payload.email ?? onboarding.email,
        city: payload.city ?? onboarding.city,
        status:
          onboarding.status === OnboardingStatus.NOT_STARTED
            ? OnboardingStatus.IN_PROGRESS
            : onboarding.status
      }
    });
  }

  async upsertVehicle(payload: UpsertDriverVehicleDto) {
    await this.ensureUser(payload.userId);
    const onboarding = await this.ensureOnboarding(payload.userId);

    return this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: {
        vehicleType: payload.vehicleType,
        vehicleNumber: payload.vehicleNumber,
        licenseNumber: payload.licenseNumber,
        aadhaarNumber: payload.aadhaarNumber ?? onboarding.aadhaarNumber,
        rcNumber: payload.rcNumber ?? onboarding.rcNumber,
        status: OnboardingStatus.IN_PROGRESS
      }
    });
  }

  async upsertBank(payload: UpsertDriverBankDto) {
    await this.ensureUser(payload.userId);
    const onboarding = await this.ensureOnboarding(payload.userId);
    const normalizedIfsc = payload.ifscCode.trim().toUpperCase();
    const normalizedUpi = payload.upiId.trim().toLowerCase();
    const normalizedUpiQrImageUrl =
      typeof payload.upiQrImageUrl === 'string' && payload.upiQrImageUrl.trim().length > 0
        ? payload.upiQrImageUrl.trim()
        : null;

    const updatedOnboarding = await this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: {
        accountHolderName: payload.accountHolderName.trim(),
        bankName: payload.bankName.trim(),
        accountNumber: payload.accountNumber.trim(),
        ifscCode: normalizedIfsc,
        upiId: normalizedUpi,
        upiQrImageUrl: normalizedUpiQrImageUrl,
        status: OnboardingStatus.IN_PROGRESS
      }
    });

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true }
    });

    if (driverProfile) {
      await this.prisma.driverPayoutAccount.upsert({
        where: { driverId: driverProfile.id },
        update: {
          accountHolderName: updatedOnboarding.accountHolderName ?? payload.accountHolderName.trim(),
          bankName: updatedOnboarding.bankName ?? payload.bankName.trim(),
          accountNumber: updatedOnboarding.accountNumber ?? payload.accountNumber.trim(),
          ifscCode: updatedOnboarding.ifscCode ?? normalizedIfsc,
          upiId: updatedOnboarding.upiId ?? normalizedUpi,
          upiQrImageUrl: updatedOnboarding.upiQrImageUrl ?? normalizedUpiQrImageUrl ?? undefined
        },
        create: {
          driverId: driverProfile.id,
          accountHolderName: updatedOnboarding.accountHolderName ?? payload.accountHolderName.trim(),
          bankName: updatedOnboarding.bankName ?? payload.bankName.trim(),
          accountNumber: updatedOnboarding.accountNumber ?? payload.accountNumber.trim(),
          ifscCode: updatedOnboarding.ifscCode ?? normalizedIfsc,
          upiId: updatedOnboarding.upiId ?? normalizedUpi,
          upiQrImageUrl: updatedOnboarding.upiQrImageUrl ?? normalizedUpiQrImageUrl ?? undefined
        }
      });
    }

    return updatedOnboarding;
  }

  async submit(userId: string) {
    const onboarding = await this.ensureOnboarding(userId);
    const missingFields = [
      ['fullName', onboarding.fullName],
      ['phone', onboarding.phone],
      ['vehicleType', onboarding.vehicleType],
      ['vehicleNumber', onboarding.vehicleNumber],
      ['licenseNumber', onboarding.licenseNumber],
      ['accountHolderName', onboarding.accountHolderName],
      ['bankName', onboarding.bankName],
      ['accountNumber', onboarding.accountNumber],
      ['ifscCode', onboarding.ifscCode],
      ['upiId', onboarding.upiId]
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing onboarding fields: ${missingFields.join(', ')}`);
    }

    return this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: OnboardingStatus.SUBMITTED,
        submittedAt: new Date()
      }
    });
  }

  async approveFromKyc(userId: string) {
    const onboarding = await this.ensureOnboarding(userId);

    const updated = await this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: OnboardingStatus.APPROVED,
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null
      }
    });

    if (
      updated.vehicleType &&
      updated.vehicleNumber &&
      updated.licenseNumber &&
      updated.aadhaarNumber
    ) {
      const driverProfile = await this.prisma.driverProfile.upsert({
        where: { userId },
        update: {
          vehicleType: updated.vehicleType,
          vehicleNumber: updated.vehicleNumber,
          licenseNumber: updated.licenseNumber,
          aadhaarNumber: updated.aadhaarNumber,
          verificationStatus: VerificationStatus.APPROVED
        },
        create: {
          userId,
          vehicleType: updated.vehicleType,
          vehicleNumber: updated.vehicleNumber,
          licenseNumber: updated.licenseNumber,
          aadhaarNumber: updated.aadhaarNumber,
          verificationStatus: VerificationStatus.APPROVED
        }
      });

      if (updated.accountHolderName && updated.bankName && updated.accountNumber && updated.ifscCode) {
        await this.prisma.driverPayoutAccount.upsert({
          where: { driverId: driverProfile.id },
          update: {
            accountHolderName: updated.accountHolderName,
            bankName: updated.bankName,
            accountNumber: updated.accountNumber,
            ifscCode: updated.ifscCode,
            upiId: updated.upiId ?? undefined,
            upiQrImageUrl: updated.upiQrImageUrl ?? undefined
          },
          create: {
            driverId: driverProfile.id,
            accountHolderName: updated.accountHolderName,
            bankName: updated.bankName,
            accountNumber: updated.accountNumber,
            ifscCode: updated.ifscCode,
            upiId: updated.upiId ?? undefined,
            upiQrImageUrl: updated.upiQrImageUrl ?? undefined
          }
        });
      }
    }

    return updated;
  }

  async rejectFromKyc(userId: string, reason: string) {
    const onboarding = await this.ensureOnboarding(userId);
    return this.prisma.driverOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: OnboardingStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason
      }
    });
  }
}
