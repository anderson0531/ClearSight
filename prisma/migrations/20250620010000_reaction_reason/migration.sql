-- Capture an optional structured reason behind a thumbs up/down so we can learn
-- why people rate an episode the way they do. Null when no reason is given or
-- the vote is cleared.

ALTER TABLE "StoryReaction" ADD COLUMN "reason" TEXT;
