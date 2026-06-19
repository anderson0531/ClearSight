-- Add shared engagement counters to Story and a per-user reaction table so the
-- podcast page can show real, shared view counts and thumbs up/down voting
-- (YouTube-style). likeCount/dislikeCount are denormalized on Story and kept in
-- sync with StoryReaction rows transactionally.

ALTER TABLE "Story" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Story" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Story" ADD COLUMN "dislikeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StoryReaction" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryReaction_storyId_userId_key" ON "StoryReaction"("storyId", "userId");
CREATE INDEX "StoryReaction_storyId_idx" ON "StoryReaction"("storyId");

ALTER TABLE "StoryReaction" ADD CONSTRAINT "StoryReaction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
