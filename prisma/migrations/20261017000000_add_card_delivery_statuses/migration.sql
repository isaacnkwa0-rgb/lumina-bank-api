-- Add delivery lifecycle statuses to CardStatus enum
ALTER TYPE "CardStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "CardStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "CardStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
