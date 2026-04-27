-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

-- AlterTable
ALTER TABLE "SigningRequest" ADD COLUMN "requestSource" TEXT;
ALTER TABLE "SigningRequest" ADD COLUMN "requestOrigin" TEXT;
