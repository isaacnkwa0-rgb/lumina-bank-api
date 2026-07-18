-- CreateEnum
CREATE TYPE "DirectDebitStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DirectDebit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "originatorName" TEXT NOT NULL,
    "originatorRef" TEXT NOT NULL,
    "userRef" TEXT NOT NULL,
    "amount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "frequency" "StandingOrderFreq" NOT NULL,
    "nextCollectionDate" TIMESTAMP(3) NOT NULL,
    "lastCollectedAt" TIMESTAMP(3),
    "status" "DirectDebitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectDebit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectDebit_userId_idx" ON "DirectDebit"("userId");

-- CreateIndex
CREATE INDEX "DirectDebit_status_idx" ON "DirectDebit"("status");

-- CreateIndex
CREATE INDEX "DirectDebit_nextCollectionDate_idx" ON "DirectDebit"("nextCollectionDate");

-- AddForeignKey
ALTER TABLE "DirectDebit" ADD CONSTRAINT "DirectDebit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectDebit" ADD CONSTRAINT "DirectDebit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
