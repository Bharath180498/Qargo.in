-- AlterTable
ALTER TABLE "Trip"
ADD COLUMN "driverPreferredPaymentMethodId" TEXT,
ADD COLUMN "driverPreferredUpiId" TEXT,
ADD COLUMN "driverPreferredPaymentLabel" TEXT,
ADD COLUMN "driverPreferredUpiQrImageUrl" TEXT;

-- CreateIndex
CREATE INDEX "Trip_driverPreferredPaymentMethodId_idx" ON "Trip"("driverPreferredPaymentMethodId");
