-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD');

-- CreateEnum
CREATE TYPE "CardLifecycleStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'LOST_REPORTED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "accountNumberFull" TEXT,
ADD COLUMN "cardBrand" "CardBrand",
ADD COLUMN "cardLifecycle" "CardLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "panFull" TEXT,
ADD COLUMN "cvv" TEXT,
ADD COLUMN "expMonth" INTEGER,
ADD COLUMN "expYear" INTEGER,
ADD COLUMN "nameOnCard" TEXT;

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
