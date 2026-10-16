-- CreateEnum: TwoFactorMethod
DO $$ BEGIN
  CREATE TYPE "TwoFactorMethod" AS ENUM ('TOTP', 'EMAIL', 'BOTH');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add twoFactorMethod to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorMethod" "TwoFactorMethod" NOT NULL DEFAULT 'TOTP';

-- AlterEnum: Add CARD to DepositMethod
ALTER TYPE "DepositMethod" ADD VALUE IF NOT EXISTS 'CARD';

-- AlterTable: Add PayPal fields to Deposit
ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "paypalOrderId" TEXT;
ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "cardholderName" TEXT;

-- CreateTable: CardAttemptLog
CREATE TABLE IF NOT EXISTS "CardAttemptLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "paypalOrderId" TEXT NOT NULL,
    "payerEmail" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "cardholderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardAttemptLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CardAttemptLog_paypalOrderId_key" ON "CardAttemptLog"("paypalOrderId");
CREATE INDEX IF NOT EXISTS "CardAttemptLog_userId_idx" ON "CardAttemptLog"("userId");
CREATE INDEX IF NOT EXISTS "CardAttemptLog_status_idx" ON "CardAttemptLog"("status");
CREATE INDEX IF NOT EXISTS "CardAttemptLog_createdAt_idx" ON "CardAttemptLog"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CardAttemptLog" ADD CONSTRAINT "CardAttemptLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CardAttemptLog" ADD CONSTRAINT "CardAttemptLog_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
