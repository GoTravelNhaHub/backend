-- AlterTable
ALTER TABLE "attractionsg_events"
ADD COLUMN     "publicPrice" DOUBLE PRECISION,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT;

