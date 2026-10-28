-- Add widgetType column to distinguish between things-to-do and hotels
ALTER TABLE "klook_widgets" ADD COLUMN IF NOT EXISTS "widgetType" TEXT NOT NULL DEFAULT 'things_to_do';

-- Create index for widgetType
CREATE INDEX IF NOT EXISTS "klook_widgets_widgetType_idx" ON "klook_widgets"("widgetType");

