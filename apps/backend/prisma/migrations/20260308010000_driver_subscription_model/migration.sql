-- CreateEnum
CREATE TYPE "DriverSubscriptionPlan" AS ENUM ('GO', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "DriverSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- AlterTable
ALTER TABLE "DriverProfile"
ADD COLUMN "subscriptionPlan" "DriverSubscriptionPlan" NOT NULL DEFAULT 'GO',
ADD COLUMN "subscriptionStatus" "DriverSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- Backfill existing drivers with a 90-day trial window
UPDATE "DriverProfile"
SET "trialEndsAt" = "createdAt" + INTERVAL '90 day'
WHERE "trialEndsAt" IS NULL;
