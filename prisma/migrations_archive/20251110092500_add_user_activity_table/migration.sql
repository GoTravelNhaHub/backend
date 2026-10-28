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

-- CreateIndex
CREATE INDEX "user_activities_timestamp_idx" ON "user_activities"("timestamp");

-- CreateIndex
CREATE INDEX "user_activities_page_idx" ON "user_activities"("page");

-- CreateIndex
CREATE INDEX "user_activities_action_idx" ON "user_activities"("action");

-- CreateIndex
CREATE INDEX "user_activities_sessionId_idx" ON "user_activities"("sessionId");

