-- Tactical mitigation: embed sessions, portal catalog, ad unlocks, AD_SPONSORED txn type

ALTER TYPE "CreditTxnType" ADD VALUE IF NOT EXISTS 'AD_SPONSORED';

CREATE TABLE "EmbedPortalSession" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "studentUserId" TEXT,
    "deviceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbedPortalSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmbedPortalStory" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbedPortalStory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdUnlock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'qa',
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmbedPortalSession_portalId_deviceHash_key" ON "EmbedPortalSession"("portalId", "deviceHash");
CREATE INDEX "EmbedPortalSession_portalId_idx" ON "EmbedPortalSession"("portalId");
CREATE INDEX "EmbedPortalSession_studentUserId_idx" ON "EmbedPortalSession"("studentUserId");

CREATE UNIQUE INDEX "EmbedPortalStory_portalId_storyId_key" ON "EmbedPortalStory"("portalId", "storyId");
CREATE INDEX "EmbedPortalStory_portalId_idx" ON "EmbedPortalStory"("portalId");

CREATE INDEX "AdUnlock_sessionId_action_usedAt_idx" ON "AdUnlock"("sessionId", "action", "usedAt");

ALTER TABLE "EmbedPortalSession" ADD CONSTRAINT "EmbedPortalSession_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "EmbedPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmbedPortalStory" ADD CONSTRAINT "EmbedPortalStory_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "EmbedPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmbedPortalStory" ADD CONSTRAINT "EmbedPortalStory_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EmbedPortalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
