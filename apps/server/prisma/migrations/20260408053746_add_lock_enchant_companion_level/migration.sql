-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "player_companions" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "player_currencies" ADD COLUMN     "enchant_stones" INTEGER NOT NULL DEFAULT 0;
