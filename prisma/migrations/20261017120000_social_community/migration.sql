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

-- AlterTable
ALTER TABLE "itinerary_generations" ADD COLUMN     "sourceTripId" TEXT;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "adaptedFromId" TEXT;

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

-- CreateIndex
CREATE INDEX "itinerary_generations_sourceTripId_idx" ON "itinerary_generations"("sourceTripId");

-- CreateIndex
CREATE INDEX "trips_adaptedFromId_idx" ON "trips"("adaptedFromId");

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


-- Hand-written. Prisma does not model CHECK constraints and leaves them alone in later diffs.
-- They back up the zod validation in the community API.

-- Public handles: lowercase letters, digits and underscore, 3-30 characters
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_handle_format" CHECK ("handle" ~ '^[a-z0-9_]{3,30}$');

ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_duration_range" CHECK ("durationDays" BETWEEN 1 AND 30);
ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_travel_month_range" CHECK ("travelMonth" IS NULL OR "travelMonth" BETWEEN 1 AND 12);
ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_counts_non_negative" CHECK ("saveCount" >= 0 AND "commentCount" >= 0 AND "adaptCount" >= 0);
-- A trip cannot be its own source
ALTER TABLE "published_trips" ADD CONSTRAINT "published_trips_parent_not_self" CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "follows" ADD CONSTRAINT "follows_not_self" CHECK ("followerId" <> "followeeId");

ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_body_length" CHECK (char_length("body") BETWEEN 1 AND 2000);
