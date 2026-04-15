-- AlterTable
ALTER TABLE "players" ADD COLUMN     "boss_kills" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_kills" INTEGER NOT NULL DEFAULT 0;
