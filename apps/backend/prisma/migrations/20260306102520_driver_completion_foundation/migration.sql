-- CreateEnum
CREATE TYPE "AuthChannel" AS ENUM ('SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AuthSessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycDocType" AS ENUM ('AADHAAR_FRONT', 'AADHAAR_BACK', 'LICENSE_FRONT', 'LICENSE_BACK', 'RC_FRONT', 'RC_BACK', 'SELFIE');

-- CreateEnum
CREATE TYPE "KycDocStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycVerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "TripOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleMatchType" AS ENUM ('EXACT', 'UPGRADE');

-- CreateTable
CREATE TABLE "OtpSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "role" "UserRole",
    "channel" "AuthChannel" NOT NULL DEFAULT 'SMS',
    "otpCode" TEXT NOT NULL,
    "status" "AuthSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "status" "AuthSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "vehicleType" "VehicleType",
    "vehicleNumber" TEXT,
    "licenseNumber" TEXT,
    "aadhaarNumber" TEXT,
    "rcNumber" TEXT,
    "accountHolderName" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "upiId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardingId" TEXT,
    "driverProfileId" TEXT,
    "type" "KycDocType" NOT NULL,
    "status" "KycDocStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "providerRef" TEXT,
    "metadata" JSONB,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardingId" TEXT,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "KycVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "riskSignals" JSONB,
    "providerResponse" JSONB,
    "reviewNotes" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPayoutAccount" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "upiId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPushToken" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tripId" TEXT,
    "driverId" TEXT NOT NULL,
    "status" "TripOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL,
    "scoreBreakdown" JSONB,
    "routeEtaMinutes" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "vehicleMatchType" "VehicleMatchType" NOT NULL DEFAULT 'EXACT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteEtaCache" (
    "id" TEXT NOT NULL,
    "originCell" TEXT NOT NULL,
    "destinationCell" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "provider" TEXT NOT NULL,
    "etaMinutes" INTEGER NOT NULL,
    "distanceMeters" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteEtaCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchDecision" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "selectedDriverId" TEXT,
    "offerId" TEXT,
    "assignmentMode" TEXT NOT NULL,
    "routeEtaMinutes" INTEGER,
    "vehicleMatchType" "VehicleMatchType",
    "totalScore" DOUBLE PRECISION,
    "decisionPayload" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpSession_phone_status_expiresAt_idx" ON "OtpSession"("phone", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_status_expiresAt_idx" ON "AuthSession"("userId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverOnboarding_userId_key" ON "DriverOnboarding"("userId");

-- CreateIndex
CREATE INDEX "KycDocument_userId_type_status_idx" ON "KycDocument"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "KycVerification_userId_status_createdAt_idx" ON "KycVerification"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayoutAccount_driverId_key" ON "DriverPayoutAccount"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPushToken_token_key" ON "DriverPushToken"("token");

-- CreateIndex
CREATE INDEX "DriverPushToken_driverId_isActive_idx" ON "DriverPushToken"("driverId", "isActive");

-- CreateIndex
CREATE INDEX "TripOffer_driverId_status_expiresAt_idx" ON "TripOffer"("driverId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "TripOffer_orderId_status_createdAt_idx" ON "TripOffer"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RouteEtaCache_originCell_destinationCell_vehicleType_expire_idx" ON "RouteEtaCache"("originCell", "destinationCell", "vehicleType", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RouteEtaCache_originCell_destinationCell_vehicleType_key" ON "RouteEtaCache"("originCell", "destinationCell", "vehicleType");

-- CreateIndex
CREATE INDEX "DispatchDecision_orderId_createdAt_idx" ON "DispatchDecision"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "DispatchDecision_selectedDriverId_createdAt_idx" ON "DispatchDecision"("selectedDriverId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverProfile_availabilityStatus_vehicleType_lastActiveAt_idx" ON "DriverProfile"("availabilityStatus", "vehicleType", "lastActiveAt");

-- AddForeignKey
ALTER TABLE "OtpSession" ADD CONSTRAINT "OtpSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverOnboarding" ADD CONSTRAINT "DriverOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "DriverOnboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "DriverOnboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayoutAccount" ADD CONSTRAINT "DriverPayoutAccount_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPushToken" ADD CONSTRAINT "DriverPushToken_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchDecision" ADD CONSTRAINT "DispatchDecision_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
