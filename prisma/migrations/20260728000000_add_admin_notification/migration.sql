-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminNotificationType') THEN
    CREATE TYPE "AdminNotificationType" AS ENUM (
      'NEW_REGISTRATION','KYC_SUBMITTED','LOAN_APPLICATION','DISPUTE_FILED',
      'INSURANCE_QUOTE','CRYPTO_ORDER','LARGE_TRANSFER','INTERNATIONAL_TRANSFER',
      'ACCOUNT_LOCKED','PASSWORD_CHANGED','SITE_VISITOR','NEW_SUPPORT_TICKET',
      'SUPPORT_MESSAGE','LARGE_DEPOSIT'
    );
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminNotification" (
  "id"        TEXT NOT NULL,
  "type"      "AdminNotificationType" NOT NULL,
  "title"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "metadata"  JSONB,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");
