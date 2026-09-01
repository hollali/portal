-- AlterTable
ALTER TABLE "audio" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "images" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT;
