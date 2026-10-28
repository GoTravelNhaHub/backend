-- Remove unnecessary columns from klook_widgets
-- Only adId is needed - each widget uses a different adId for different categories

ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "widgetId";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "city";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "lang";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "height";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "productType";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "cardH";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "padding";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "lgH";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "edgeValue";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "cid";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "tid";
ALTER TABLE "klook_widgets" DROP COLUMN IF EXISTS "amount";

