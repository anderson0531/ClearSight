-- CreateTable
CREATE TABLE "ChannelIntroAudio" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "audioUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelIntroAudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelIntroAudio_showId_language_key" ON "ChannelIntroAudio"("showId", "language");

-- CreateIndex
CREATE INDEX "ChannelIntroAudio_showId_idx" ON "ChannelIntroAudio"("showId");
