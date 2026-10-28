-- Family traveller profiles, saved trips and AI itinerary generations
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "itinerary_generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "travellers_userId_idx" ON "travellers"("userId");
CREATE UNIQUE INDEX "trips_generationId_key" ON "trips"("generationId");
CREATE INDEX "trips_userId_idx" ON "trips"("userId");
CREATE INDEX "itinerary_generations_clientKey_createdAt_idx" ON "itinerary_generations"("clientKey", "createdAt");
CREATE INDEX "itinerary_generations_createdAt_idx" ON "itinerary_generations"("createdAt");

ALTER TABLE "travellers" ADD CONSTRAINT "travellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
