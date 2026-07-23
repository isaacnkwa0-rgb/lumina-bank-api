-- Add AGENT value to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AGENT';
