-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "creditLimitCents" INTEGER,
ADD COLUMN     "allowOverLimit" BOOLEAN NOT NULL DEFAULT false;
