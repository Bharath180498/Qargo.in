-- CreateTable
CREATE TABLE "TripDeliveryProof" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverSignature" JSONB NOT NULL,
    "signatureCapturedAt" TIMESTAMP(3),
    "photoFileKey" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "photoMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripDeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripDeliveryProof_tripId_key" ON "TripDeliveryProof"("tripId");

-- CreateIndex
CREATE INDEX "TripDeliveryProof_driverId_createdAt_idx" ON "TripDeliveryProof"("driverId", "createdAt");

-- AddForeignKey
ALTER TABLE "TripDeliveryProof" ADD CONSTRAINT "TripDeliveryProof_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripDeliveryProof" ADD CONSTRAINT "TripDeliveryProof_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
