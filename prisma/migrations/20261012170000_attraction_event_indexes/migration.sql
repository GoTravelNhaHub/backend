-- Listing and detail pages filter published events and look them up by slug.
CREATE INDEX "attractionsg_events_isPublished_idx" ON "attractionsg_events"("isPublished");
CREATE INDEX "attractionsg_events_slug_idx" ON "attractionsg_events"("slug");
CREATE INDEX "attractionsg_events_isActive_isPublished_idx" ON "attractionsg_events"("isActive", "isPublished");
