-- CreateTable
CREATE TABLE "battle_logs" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "zone" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "victory" BOOLEAN NOT NULL,
    "rounds" INTEGER NOT NULL,
    "gold_earned" INTEGER NOT NULL,
    "exp_earned" INTEGER NOT NULL,
    "leveled_up" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_logs_player_id_created_at_idx" ON "battle_logs"("player_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "battle_logs" ADD CONSTRAINT "battle_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
