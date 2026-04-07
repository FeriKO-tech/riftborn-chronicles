-- CreateTable
CREATE TABLE "player_shop_purchases" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_shop_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_shop_purchases_player_id_period_key_idx" ON "player_shop_purchases"("player_id", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "player_shop_purchases_player_id_offer_id_period_key_key" ON "player_shop_purchases"("player_id", "offer_id", "period_key");

-- AddForeignKey
ALTER TABLE "player_shop_purchases" ADD CONSTRAINT "player_shop_purchases_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
