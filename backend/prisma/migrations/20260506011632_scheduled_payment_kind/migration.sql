-- CreateEnum
CREATE TYPE "ScheduledPaymentKind" AS ENUM ('SCHEDULED', 'INSTANT');

-- AlterTable
ALTER TABLE "ScheduledPayment" ADD COLUMN     "kind" "ScheduledPaymentKind" NOT NULL DEFAULT 'SCHEDULED';
