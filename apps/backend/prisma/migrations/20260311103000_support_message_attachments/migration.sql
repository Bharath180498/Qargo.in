-- CreateTable
CREATE TABLE "SupportTicketMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicketMessageAttachment_messageId_createdAt_idx" ON "SupportTicketMessageAttachment"("messageId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportTicketMessageAttachment" ADD CONSTRAINT "SupportTicketMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "SupportTicket"
ADD COLUMN "descriptionSourceLanguage" TEXT,
ADD COLUMN "descriptionTranslatedEnglish" TEXT,
ADD COLUMN "descriptionTranslationProvider" TEXT;

-- AlterTable
ALTER TABLE "SupportTicketMessage"
ADD COLUMN "sourceLanguage" TEXT,
ADD COLUMN "translatedEnglish" TEXT,
ADD COLUMN "translationProvider" TEXT;
