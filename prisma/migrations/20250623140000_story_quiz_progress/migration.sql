-- CreateTable
CREATE TABLE "StoryQuizProgress" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "bestTotal" INTEGER NOT NULL,
    "lastScore" INTEGER NOT NULL,
    "lastTotal" INTEGER NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryQuizProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryQuizProgress_userId_idx" ON "StoryQuizProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryQuizProgress_storyId_userId_key" ON "StoryQuizProgress"("storyId", "userId");

-- AddForeignKey
ALTER TABLE "StoryQuizProgress" ADD CONSTRAINT "StoryQuizProgress_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
