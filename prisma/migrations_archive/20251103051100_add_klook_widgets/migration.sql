-- CreateTable
CREATE TABLE "klook_widgets" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "lang" TEXT DEFAULT 'en',
    "currency" TEXT DEFAULT 'SGD',
    "height" TEXT DEFAULT '400px',
    "productType" TEXT DEFAULT 'search_vertical',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "klook_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "klook_widgets_isActive_idx" ON "klook_widgets"("isActive");

-- CreateIndex
CREATE INDEX "klook_widgets_displayOrder_idx" ON "klook_widgets"("displayOrder");
