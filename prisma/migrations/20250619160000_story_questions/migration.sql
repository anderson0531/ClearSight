-- Moderated podcast Q&A. Premium/Creator users ask on-topic questions and a
-- channel host answers with grounded text + synthesized audio in the selected
-- language. Answered Q&A is public and persisted on the episode.

CREATE TABLE "StoryQuestion" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "rawQuestion" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "responderName" TEXT NOT NULL,
    "responderShortName" TEXT NOT NULL,
    "responderRole" TEXT NOT NULL,
    "audioUrl" TEXT,
    "durationSeconds" INTEGER,
    "segments" JSONB,
    "creditsCharged" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoryQuestion_storyId_createdAt_idx" ON "StoryQuestion"("storyId", "createdAt");

ALTER TABLE "StoryQuestion" ADD CONSTRAINT "StoryQuestion_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
