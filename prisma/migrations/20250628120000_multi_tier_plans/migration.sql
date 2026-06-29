-- Multi-tier plans: rename legacy tiers, add new enum values, dual credit pool.

ALTER TYPE "Plan" RENAME VALUE 'PREMIUM' TO 'PREMIUM_PLUS';
ALTER TYPE "Plan" RENAME VALUE 'CREATOR' TO 'CREATOR_PREMIUM';

ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'PREMIUM';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'PREMIUM_ELITE';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'CREATOR_PLUS';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'CREATOR_ELITE';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lessonTokens" INTEGER NOT NULL DEFAULT 0;

-- Embed portals (Creator track)
CREATE TABLE IF NOT EXISTS "EmbedPortal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "allowedDomain" TEXT,
    "studentSlotLimit" INTEGER NOT NULL DEFAULT 35,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbedPortal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmbedPortal_token_key" ON "EmbedPortal"("token");
CREATE INDEX IF NOT EXISTS "EmbedPortal_userId_idx" ON "EmbedPortal"("userId");

ALTER TABLE "EmbedPortal" DROP CONSTRAINT IF EXISTS "EmbedPortal_userId_fkey";
ALTER TABLE "EmbedPortal" ADD CONSTRAINT "EmbedPortal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
