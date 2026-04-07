-- CreateTable
CREATE TABLE "zone_kill_progress" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "zone" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_kill_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zone_kill_progress_player_id_idx" ON "zone_kill_progress"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_kill_progress_player_id_zone_key" ON "zone_kill_progress"("player_id", "zone");

-- AddForeignKey
ALTER TABLE "zone_kill_progress" ADD CONSTRAINT "zone_kill_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
