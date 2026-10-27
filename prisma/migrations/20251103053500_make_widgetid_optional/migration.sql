-- Make widgetId optional and update productType default
ALTER TABLE "klook_widgets" ALTER COLUMN "widgetId" DROP NOT NULL;
ALTER TABLE "klook_widgets" ALTER COLUMN "productType" SET DEFAULT 'dynamic_widget';

