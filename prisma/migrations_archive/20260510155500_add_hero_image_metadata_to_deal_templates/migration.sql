ALTER TABLE "deal_templates"
ADD COLUMN "heroImageSource" TEXT DEFAULT 'manual',
ADD COLUMN "heroImageFetchedAt" TIMESTAMP(3);
