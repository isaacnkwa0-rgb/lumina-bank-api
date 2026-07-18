-- CreateEnum
CREATE TYPE "StandingOrderFreq" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "StandingOrderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorRecoveryCodes" JSONB;

-- CreateTable
CREATE TABLE "StandingOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountNumber" TEXT NOT NULL,
    "toBankCode" TEXT NOT NULL,
    "toAccountName" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "description" TEXT NOT NULL,
    "frequency" "StandingOrderFreq" NOT NULL,
    "nextExecutionDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "StandingOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastExecutedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandingOrder_userId_idx" ON "StandingOrder"("userId");

-- CreateIndex
CREATE INDEX "StandingOrder_status_idx" ON "StandingOrder"("status");

-- CreateIndex
CREATE INDEX "StandingOrder_nextExecutionDate_idx" ON "StandingOrder"("nextExecutionDate");

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
