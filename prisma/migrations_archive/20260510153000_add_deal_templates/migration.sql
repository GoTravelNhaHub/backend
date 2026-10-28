-- Create table for DB-backed deal page templates
CREATE TABLE "deal_templates" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "heroImage" TEXT NOT NULL,
  "badge" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "lastUpdatedLabel" TEXT NOT NULL,
  "primaryProvider" TEXT NOT NULL,
  "primaryCtaLabel" TEXT NOT NULL,
  "primaryBaseUrl" TEXT NOT NULL,
  "placementKey" TEXT NOT NULL,
  "summaryBullets" JSONB NOT NULL,
  "tips" JSONB NOT NULL,
  "comparison" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deal_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_templates_slug_key" ON "deal_templates"("slug");
CREATE INDEX "deal_templates_isActive_updatedAt_idx" ON "deal_templates"("isActive", "updatedAt");
CREATE INDEX "deal_templates_slug_isActive_idx" ON "deal_templates"("slug", "isActive");
CREATE INDEX "deal_templates_placementKey_idx" ON "deal_templates"("placementKey");
