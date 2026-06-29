-- Remove Creator plans, lesson token pool, and embed portal infrastructure.
-- Migrate existing Creator subscribers to PREMIUM_ELITE with merged credits.

UPDATE "User"
SET
  plan = 'PREMIUM_ELITE',
  "coreTokens" = "coreTokens" + "lessonTokens"
WHERE plan IN ('CREATOR_PREMIUM', 'CREATOR_PLUS', 'CREATOR_ELITE');

DROP TABLE IF EXISTS "AdUnlock";
DROP TABLE IF EXISTS "EmbedPortalSession";
DROP TABLE IF EXISTS "EmbedPortalStory";
DROP TABLE IF EXISTS "EmbedPortal";

ALTER TABLE "User" DROP COLUMN IF EXISTS "lessonTokens";

ALTER TYPE "Plan" RENAME TO "Plan_old";
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM', 'PREMIUM_PLUS', 'PREMIUM_ELITE');
ALTER TABLE "User" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "plan" TYPE "Plan" USING ("plan"::text::"Plan");
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'FREE';
DROP TYPE "Plan_old";
