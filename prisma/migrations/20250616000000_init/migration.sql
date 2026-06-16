-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "whopUserId" TEXT,
    "email" TEXT,
    "affiliateCode" TEXT,
    "coreTokens" INTEGER NOT NULL DEFAULT 0,
    "subscriptionActive" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionCycleStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "geoScope" TEXT NOT NULL,
    "geoRegion" TEXT,
    "geoCountry" TEXT,
    "geoState" TEXT,
    "geoLocal" TEXT,
    "markdownContent" TEXT NOT NULL,
    "audioUrl" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "reliabilityIndex" DOUBLE PRECISION,
    "sourcesVerified" JSONB,
    "isCached" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT,
    "taxonomyKey" TEXT NOT NULL,
    "tokenConsumed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL,
    "affiliateCode" TEXT NOT NULL,
    "referredUserId" TEXT,
    "whopPaymentId" TEXT,
    "payoutAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_whopUserId_key" ON "User"("whopUserId");

-- CreateIndex
CREATE INDEX "Story_language_category_geoScope_idx" ON "Story"("language", "category", "geoScope");

-- CreateIndex
CREATE INDEX "Story_language_category_geoScope_geoCountry_idx" ON "Story"("language", "category", "geoScope", "geoCountry");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateReferral_whopPaymentId_key" ON "AffiliateReferral"("whopPaymentId");

-- CreateIndex
CREATE INDEX "AffiliateReferral_affiliateCode_idx" ON "AffiliateReferral"("affiliateCode");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
