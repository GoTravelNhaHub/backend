-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'SIGNED_UP', 'COMPLETED_BOOKING', 'REWARDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TripVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('TIP', 'QUESTION');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('TRIP', 'COMMENT', 'PROFILE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "keycloakId" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "providerImage" TEXT,
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "referralCode" TEXT NOT NULL,
    "email" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "signupAt" TIMESTAMP(3),
    "firstBookingAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "featuredImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "seoMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "page" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB,
    "userAgent" TEXT,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_entities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_offers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerProductId" TEXT,
    "baseUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "priceAmount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'SGD',
    "priceText" TEXT,
    "score" DOUBLE PRECISION DEFAULT 0,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
    "lastVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_placements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_click_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "entityId" TEXT,
    "offerId" TEXT,
    "provider" TEXT NOT NULL,
    "placementKey" TEXT,
    "placementId" TEXT,
    "pagePath" TEXT,
    "referrer" TEXT,
    "deviceType" TEXT,
    "subId" TEXT,
    "outboundUrl" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_conversion_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "orderId" TEXT,
    "saleAmount" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "status" TEXT,
    "occurredAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klook_promo_codes" (
    "id" TEXT NOT NULL,
    "promoCode" TEXT NOT NULL,
    "discountDescription" TEXT NOT NULL,
    "promoCodeDescription" TEXT NOT NULL,
    "affiliateDescription" TEXT NOT NULL,
    "applicablePlatforms" TEXT NOT NULL,
    "redeemFrom" TIMESTAMP(3) NOT NULL,
    "redeemBefore" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "termsAndConditions" TEXT NOT NULL,
    "applicableToResidentsOf" TEXT,
    "notApplicableToResidentsOf" TEXT,
    "nonApplicableActivitiesUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "klook_promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klook_hotel_deals" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "dealCategory" TEXT NOT NULL,
    "starRating" INTEGER,
    "originalPrice" DECIMAL(65,30) NOT NULL,
    "discountedPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "savings" DECIMAL(65,30) NOT NULL,
    "savingsPercent" DECIMAL(65,30),
    "affiliateLink" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "klook_hotel_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klook_widgets" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT,
    "widgetType" TEXT NOT NULL DEFAULT 'things_to_do',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "klook_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "heroImage" TEXT NOT NULL,
    "heroImageSource" TEXT DEFAULT 'manual',
    "heroImageFetchedAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "travellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "birthDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generationId" TEXT,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "budget" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "party" JSONB NOT NULL,
    "preferences" JSONB,
    "itinerary" JSONB NOT NULL,
    "shareId" TEXT,
    "adaptedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientKey" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "itinerary" JSONB,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "sourceTripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference" TEXT,
    "userId" TEXT,
    "emailedAt" TIMESTAMP(3),
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traveler_profiles" (
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "favoriteDestinations" TEXT[],
    "homeCountry" TEXT,
    "showSavedTrips" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traveler_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "published_trips" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "sourceTripId" TEXT,
    "parentId" TEXT,
    "visibility" "TripVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "destination" TEXT NOT NULL,
    "country" TEXT,
    "durationDays" INTEGER NOT NULL,
    "travelMonth" INTEGER,
    "travelStyle" TEXT,
    "budgetLevel" TEXT,
    "familyFriendly" BOOLEAN NOT NULL DEFAULT false,
    "childAgeBands" TEXT[],
    "itinerary" JSONB NOT NULL,
    "tips" TEXT[],
    "coverImage" TEXT,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "adaptCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_trips" (
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_trips_pkey" PRIMARY KEY ("userId","tripId")
);

-- CreateTable
CREATE TABLE "follows" (
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("followerId","followeeId")
);

-- CreateTable
CREATE TABLE "trip_comments" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "kind" "CommentKind" NOT NULL DEFAULT 'TIP',
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloakId_key" ON "users"("keycloakId");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_providerId_key" ON "users"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_refereeId_key" ON "referrals"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referralCode_key" ON "referrals"("referralCode");

-- CreateIndex
CREATE INDEX "referrals_referralCode_idx" ON "referrals"("referralCode");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_category_idx" ON "blog_posts"("category");

-- CreateIndex
CREATE INDEX "blog_posts_isPublished_idx" ON "blog_posts"("isPublished");

-- CreateIndex
CREATE INDEX "user_activities_timestamp_idx" ON "user_activities"("timestamp");

-- CreateIndex
CREATE INDEX "user_activities_page_idx" ON "user_activities"("page");

-- CreateIndex
CREATE INDEX "user_activities_action_idx" ON "user_activities"("action");

-- CreateIndex
CREATE INDEX "user_activities_sessionId_idx" ON "user_activities"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_entities_slug_key" ON "affiliate_entities"("slug");

-- CreateIndex
CREATE INDEX "affiliate_entities_status_idx" ON "affiliate_entities"("status");

-- CreateIndex
CREATE INDEX "affiliate_entities_location_idx" ON "affiliate_entities"("location");

-- CreateIndex
CREATE INDEX "affiliate_entities_category_idx" ON "affiliate_entities"("category");

-- CreateIndex
CREATE INDEX "affiliate_offers_entityId_isActive_idx" ON "affiliate_offers"("entityId", "isActive");

-- CreateIndex
CREATE INDEX "affiliate_offers_provider_isActive_idx" ON "affiliate_offers"("provider", "isActive");

-- CreateIndex
CREATE INDEX "affiliate_offers_availabilityStatus_idx" ON "affiliate_offers"("availabilityStatus");

-- CreateIndex
CREATE INDEX "affiliate_offers_lastVerifiedAt_idx" ON "affiliate_offers"("lastVerifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_placements_key_key" ON "affiliate_placements"("key");

-- CreateIndex
CREATE INDEX "affiliate_placements_isActive_idx" ON "affiliate_placements"("isActive");

-- CreateIndex
CREATE INDEX "affiliate_click_events_sessionId_idx" ON "affiliate_click_events"("sessionId");

-- CreateIndex
CREATE INDEX "affiliate_click_events_provider_idx" ON "affiliate_click_events"("provider");

-- CreateIndex
CREATE INDEX "affiliate_click_events_subId_idx" ON "affiliate_click_events"("subId");

-- CreateIndex
CREATE INDEX "affiliate_click_events_entityId_idx" ON "affiliate_click_events"("entityId");

-- CreateIndex
CREATE INDEX "affiliate_click_events_offerId_idx" ON "affiliate_click_events"("offerId");

-- CreateIndex
CREATE INDEX "affiliate_click_events_placementKey_idx" ON "affiliate_click_events"("placementKey");

-- CreateIndex
CREATE INDEX "affiliate_click_events_createdAt_idx" ON "affiliate_click_events"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_conversion_events_provider_subId_idx" ON "affiliate_conversion_events"("provider", "subId");

-- CreateIndex
CREATE INDEX "affiliate_conversion_events_createdAt_idx" ON "affiliate_conversion_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_conversion_events_provider_orderId_key" ON "affiliate_conversion_events"("provider", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "klook_promo_codes_promoCode_key" ON "klook_promo_codes"("promoCode");

-- CreateIndex
CREATE INDEX "klook_promo_codes_promoCode_idx" ON "klook_promo_codes"("promoCode");

-- CreateIndex
CREATE INDEX "klook_promo_codes_isActive_idx" ON "klook_promo_codes"("isActive");

-- CreateIndex
CREATE INDEX "klook_promo_codes_validUntil_idx" ON "klook_promo_codes"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "klook_hotel_deals_hotelId_key" ON "klook_hotel_deals"("hotelId");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_hotelId_idx" ON "klook_hotel_deals"("hotelId");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_dealCategory_idx" ON "klook_hotel_deals"("dealCategory");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_isActive_idx" ON "klook_hotel_deals"("isActive");

-- CreateIndex
CREATE INDEX "klook_hotel_deals_updatedAt_idx" ON "klook_hotel_deals"("updatedAt");

-- CreateIndex
CREATE INDEX "klook_widgets_isActive_idx" ON "klook_widgets"("isActive");

-- CreateIndex
CREATE INDEX "klook_widgets_displayOrder_idx" ON "klook_widgets"("displayOrder");

-- CreateIndex
CREATE INDEX "klook_widgets_widgetType_idx" ON "klook_widgets"("widgetType");

-- CreateIndex
CREATE UNIQUE INDEX "klook_widgets_name_key" ON "klook_widgets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "deal_templates_slug_key" ON "deal_templates"("slug");

-- CreateIndex
CREATE INDEX "deal_templates_isActive_updatedAt_idx" ON "deal_templates"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "deal_templates_slug_isActive_idx" ON "deal_templates"("slug", "isActive");

-- CreateIndex
CREATE INDEX "deal_templates_placementKey_idx" ON "deal_templates"("placementKey");

-- CreateIndex
CREATE INDEX "travellers_userId_idx" ON "travellers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trips_generationId_key" ON "trips"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "trips_shareId_key" ON "trips"("shareId");

-- CreateIndex
CREATE INDEX "trips_userId_idx" ON "trips"("userId");

-- CreateIndex
CREATE INDEX "trips_adaptedFromId_idx" ON "trips"("adaptedFromId");

-- CreateIndex
CREATE INDEX "itinerary_generations_clientKey_createdAt_idx" ON "itinerary_generations"("clientKey", "createdAt");

-- CreateIndex
CREATE INDEX "itinerary_generations_createdAt_idx" ON "itinerary_generations"("createdAt");

-- CreateIndex
CREATE INDEX "itinerary_generations_sourceTripId_idx" ON "itinerary_generations"("sourceTripId");

-- CreateIndex
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");

-- CreateIndex
CREATE INDEX "contact_messages_handledAt_idx" ON "contact_messages"("handledAt");

-- CreateIndex
CREATE UNIQUE INDEX "traveler_profiles_handle_key" ON "traveler_profiles"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "published_trips_slug_key" ON "published_trips"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "published_trips_sourceTripId_key" ON "published_trips"("sourceTripId");

-- CreateIndex
CREATE INDEX "published_trips_visibility_status_publishedAt_idx" ON "published_trips"("visibility", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "published_trips_visibility_status_saveCount_idx" ON "published_trips"("visibility", "status", "saveCount" DESC);

-- CreateIndex
CREATE INDEX "published_trips_destination_visibility_status_idx" ON "published_trips"("destination", "visibility", "status");

-- CreateIndex
CREATE INDEX "published_trips_country_visibility_status_idx" ON "published_trips"("country", "visibility", "status");

-- CreateIndex
CREATE INDEX "published_trips_authorId_visibility_status_idx" ON "published_trips"("authorId", "visibility", "status");

-- CreateIndex
CREATE INDEX "published_trips_parentId_idx" ON "published_trips"("parentId");

-- CreateIndex
CREATE INDEX "saved_trips_userId_createdAt_idx" ON "saved_trips"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "saved_trips_tripId_idx" ON "saved_trips"("tripId");

-- CreateIndex
CREATE INDEX "follows_followeeId_createdAt_idx" ON "follows"("followeeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "trip_comments_tripId_status_createdAt_idx" ON "trip_comments"("tripId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "trip_comments_authorId_createdAt_idx" ON "trip_comments"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "content_reports_status_createdAt_idx" ON "content_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "content_reports_targetType_targetId_idx" ON "content_reports"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporterId_targetType_targetId_key" ON "content_reports"("reporterId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "affiliate_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_events" ADD CONSTRAINT "affiliate_click_events_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "affiliate_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_events" ADD CONSTRAINT "affiliate_click_events_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "affiliate_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_events" ADD CONSTRAINT "affiliate_click_events_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "affiliate_placements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travellers" ADD CONSTRAINT "travellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_adaptedFromId_fkey" FOREIGN KEY ("adaptedFromId") REFERENCES "published_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_generations" ADD CONSTRAINT "itinerary_generations_sourceTripId_fkey" FOREIGN KEY ("sourceTripId") REFERENCES "published_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "traveler_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_sourceTripId_fkey" FOREIGN KEY ("sourceTripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "published_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trips" ADD CONSTRAINT "saved_trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trips" ADD CONSTRAINT "saved_trips_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "published_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "traveler_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "published_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

