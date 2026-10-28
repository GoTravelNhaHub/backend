-- AlterTable
ALTER TABLE "attractionsg_events"
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

