-- Contact form messages, kept even when the notification email fails
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

CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");
CREATE INDEX "contact_messages_handledAt_idx" ON "contact_messages"("handledAt");
