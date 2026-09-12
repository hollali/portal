-- AlterTable
ALTER TABLE "images" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "curated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "date_taken" TEXT,
ADD COLUMN     "event" TEXT,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "parliament" TEXT,
ADD COLUMN     "person" TEXT,
ADD COLUMN     "theme" TEXT,
ADD COLUMN     "year" INTEGER;

-- CreateTable
CREATE TABLE "archive_items" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" TEXT,
    "year" INTEGER,
    "event" TEXT,
    "location" TEXT,
    "person" TEXT,
    "institution" TEXT,
    "parliament" TEXT,
    "theme" TEXT,
    "venue" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "excerpt" TEXT,
    "body" TEXT,
    "file_path" TEXT,
    "file_name" TEXT,
    "cover_url" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" SERIAL NOT NULL,
    "author" TEXT NOT NULL,
    "role" TEXT,
    "quote" TEXT NOT NULL,
    "source" TEXT,
    "year" INTEGER,
    "photo_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" SERIAL NOT NULL,
    "year" TEXT NOT NULL,
    "period" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'career',
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archive_items_slug_key" ON "archive_items"("slug");

-- CreateIndex
CREATE INDEX "archive_items_kind_idx" ON "archive_items"("kind");

-- CreateIndex
CREATE INDEX "archive_items_status_idx" ON "archive_items"("status");

-- CreateIndex
CREATE INDEX "archive_items_year_idx" ON "archive_items"("year");

-- CreateIndex
CREATE INDEX "milestones_category_idx" ON "milestones"("category");

-- CreateIndex
CREATE INDEX "images_year_idx" ON "images"("year");

-- CreateIndex
CREATE INDEX "images_curated_idx" ON "images"("curated");
