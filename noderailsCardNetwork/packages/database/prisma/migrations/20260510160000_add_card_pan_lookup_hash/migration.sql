-- AlterTable
ALTER TABLE "Card" ADD COLUMN "panLookupHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Card_panLookupHash_key" ON "Card"("panLookupHash");
