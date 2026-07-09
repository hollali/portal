-- CreateTable
CREATE TABLE "images" (
    "id" SERIAL NOT NULL,
    "source" TEXT,
    "query" TEXT,
    "url" TEXT,
    "local_path" TEXT,
    "collected_at" TEXT,
    "face_detected" INTEGER DEFAULT 0,
    "face_count" INTEGER DEFAULT 0,
    "face_match" INTEGER DEFAULT 0,
    "face_match_score" DOUBLE PRECISION DEFAULT 0.0,
    "face_match_distance" DOUBLE PRECISION,
    "best_reference_path" TEXT DEFAULT '',
    "image_hash" TEXT,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" SERIAL NOT NULL,
    "source" TEXT,
    "platform" TEXT,
    "title" TEXT,
    "url" TEXT,
    "channel" TEXT,
    "duration" INTEGER,
    "views" INTEGER,
    "collected_at" TEXT,
    "local_path" TEXT,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" SERIAL NOT NULL,
    "source" TEXT,
    "query" TEXT,
    "title" TEXT,
    "url" TEXT,
    "source_name" TEXT,
    "date" TEXT,
    "snippet" TEXT,
    "collected_at" TEXT,
    "local_path" TEXT,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio" (
    "id" SERIAL NOT NULL,
    "source" TEXT,
    "query" TEXT,
    "title" TEXT,
    "url" TEXT,
    "artist" TEXT,
    "duration" TEXT,
    "collected_at" TEXT,
    "local_path" TEXT,

    CONSTRAINT "audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "images_url_key" ON "images"("url");

-- CreateIndex
CREATE UNIQUE INDEX "videos_url_key" ON "videos"("url");

-- CreateIndex
CREATE UNIQUE INDEX "news_url_key" ON "news"("url");

-- CreateIndex
CREATE UNIQUE INDEX "audio_url_key" ON "audio"("url");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
