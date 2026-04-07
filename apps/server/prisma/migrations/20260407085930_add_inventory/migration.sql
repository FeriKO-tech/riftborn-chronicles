-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "item_level" INTEGER NOT NULL DEFAULT 1,
    "is_equipped" BOOLEAN NOT NULL DEFAULT false,
    "atk_bonus" INTEGER NOT NULL DEFAULT 0,
    "def_bonus" INTEGER NOT NULL DEFAULT 0,
    "hp_bonus" INTEGER NOT NULL DEFAULT 0,
    "obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_player_id_idx" ON "inventory_items"("player_id");

-- CreateIndex
CREATE INDEX "inventory_items_player_id_is_equipped_idx" ON "inventory_items"("player_id", "is_equipped");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
