-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('LIFE', 'HOME', 'CAR', 'TRAVEL', 'HEALTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('REQUESTED', 'QUOTED', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "InsuranceQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InsuranceType" NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'REQUESTED',
    "details" JSONB NOT NULL,
    "premium" DECIMAL(18,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsuranceQuote_userId_idx" ON "InsuranceQuote"("userId");

-- CreateIndex
CREATE INDEX "InsuranceQuote_status_idx" ON "InsuranceQuote"("status");

-- CreateIndex
CREATE INDEX "InsuranceQuote_createdAt_idx" ON "InsuranceQuote"("createdAt");

-- AddForeignKey
ALTER TABLE "InsuranceQuote" ADD CONSTRAINT "InsuranceQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
