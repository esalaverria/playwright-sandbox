-- User-level card settings
ALTER TABLE "User"
ADD COLUMN "defaultCardLimitCents" INTEGER NOT NULL DEFAULT 500000,
ADD COLUMN "primaryCardId" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_primaryCardId_fkey"
FOREIGN KEY ("primaryCardId") REFERENCES "Account"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_primaryCardId_key" ON "User"("primaryCardId");
