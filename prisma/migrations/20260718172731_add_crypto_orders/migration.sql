-- CreateEnum
CREATE TYPE "CryptoOrderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "CryptoOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amountGbp" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL DEFAULT 1.50,
    "priceGbp" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "status" "CryptoOrderStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT NOT NULL,
    "adminNotes" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrder_reference_key" ON "CryptoOrder"("reference");

-- CreateIndex
CREATE INDEX "CryptoOrder_userId_idx" ON "CryptoOrder"("userId");

-- CreateIndex
CREATE INDEX "CryptoOrder_status_idx" ON "CryptoOrder"("status");

-- CreateIndex
CREATE INDEX "CryptoOrder_createdAt_idx" ON "CryptoOrder"("createdAt");

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
