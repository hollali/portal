-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audio_source_idx" ON "audio"("source");

-- CreateIndex
CREATE INDEX "audio_artist_idx" ON "audio"("artist");

-- CreateIndex
CREATE INDEX "audio_collected_at_idx" ON "audio"("collected_at");

-- CreateIndex
CREATE INDEX "images_source_idx" ON "images"("source");

-- CreateIndex
CREATE INDEX "images_collected_at_idx" ON "images"("collected_at");

-- CreateIndex
CREATE INDEX "news_source_idx" ON "news"("source");

-- CreateIndex
CREATE INDEX "news_source_name_idx" ON "news"("source_name");

-- CreateIndex
CREATE INDEX "news_date_idx" ON "news"("date");

-- CreateIndex
CREATE INDEX "news_collected_at_idx" ON "news"("collected_at");

-- CreateIndex
CREATE INDEX "videos_source_idx" ON "videos"("source");

-- CreateIndex
CREATE INDEX "videos_platform_idx" ON "videos"("platform");

-- CreateIndex
CREATE INDEX "videos_collected_at_idx" ON "videos"("collected_at");
