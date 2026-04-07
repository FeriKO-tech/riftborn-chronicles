-- CreateTable
CREATE TABLE "player_quests" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target_value" INTEGER NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "period_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_quests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_quests_player_id_period_key_idx" ON "player_quests"("player_id", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "player_quests_player_id_template_id_period_key_key" ON "player_quests"("player_id", "template_id", "period_key");

-- AddForeignKey
ALTER TABLE "player_quests" ADD CONSTRAINT "player_quests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
