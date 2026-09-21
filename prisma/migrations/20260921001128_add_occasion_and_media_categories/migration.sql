-- AlterTable
ALTER TABLE "archive_items" ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "occasion" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "video_url" TEXT;

-- AlterTable
ALTER TABLE "audio" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "date" TEXT,
ADD COLUMN     "event" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN     "theme" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "date" TEXT,
ADD COLUMN     "event" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN     "theme" TEXT,
ADD COLUMN     "year" INTEGER;

-- CreateIndex
CREATE INDEX "audio_category_idx" ON "audio"("category");

-- CreateIndex
CREATE INDEX "audio_year_idx" ON "audio"("year");

-- CreateIndex
CREATE INDEX "audio_status_idx" ON "audio"("status");

-- CreateIndex
CREATE INDEX "videos_category_idx" ON "videos"("category");

-- CreateIndex
CREATE INDEX "videos_year_idx" ON "videos"("year");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");
