-- Q&A audio is now produced asynchronously after the text answer is delivered.
-- Track its lifecycle so the UI can show a "generating audio" state and stop
-- polling once it is ready (or known to have failed).

ALTER TABLE "StoryQuestion" ADD COLUMN "audioStatus" TEXT NOT NULL DEFAULT 'pending';
