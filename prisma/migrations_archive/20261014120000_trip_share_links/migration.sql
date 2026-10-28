-- Public share links for saved trips. NULL keeps a trip private.
ALTER TABLE "trips" ADD COLUMN "shareId" TEXT;

CREATE UNIQUE INDEX "trips_shareId_key" ON "trips"("shareId");
