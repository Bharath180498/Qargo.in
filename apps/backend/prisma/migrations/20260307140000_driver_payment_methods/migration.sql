-- CreateEnum
CREATE TYPE "DriverPaymentMethodType" AS ENUM ('UPI_QR', 'UPI_VPA');

-- CreateTable
CREATE TABLE "DriverPaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "driverId" TEXT,
    "type" "DriverPaymentMethodType" NOT NULL DEFAULT 'UPI_QR',
    "label" TEXT,
    "upiId" TEXT NOT NULL,
    "qrImageUrl" TEXT,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverPaymentMethod_userId_isActive_isPreferred_idx" ON "DriverPaymentMethod"("userId", "isActive", "isPreferred");

-- CreateIndex
CREATE INDEX "DriverPaymentMethod_driverId_isActive_isPreferred_idx" ON "DriverPaymentMethod"("driverId", "isActive", "isPreferred");

-- AddForeignKey
ALTER TABLE "DriverPaymentMethod" ADD CONSTRAINT "DriverPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPaymentMethod" ADD CONSTRAINT "DriverPaymentMethod_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
