-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ES', 'FR', 'PT', 'DE');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "preferredLanguage" "Language" NOT NULL DEFAULT 'EN';
