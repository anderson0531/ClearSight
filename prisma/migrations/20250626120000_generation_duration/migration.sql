-- Track wall-clock time from enqueue to audio ready and to full pipeline completion.
ALTER TABLE "Generation" ADD COLUMN "audioCompletedAt" TIMESTAMP(3);
ALTER TABLE "Generation" ADD COLUMN "completedAt" TIMESTAMP(3);
