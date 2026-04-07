-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "enhancement_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "active_companion_id" TEXT;

-- CreateTable
CREATE TABLE "player_companions" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_companions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boss_attempts" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "boss_id" TEXT NOT NULL,
    "attempts_used" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boss_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pvp_profiles" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "defense_snapshot" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pvp_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pvp_battles" (
    "id" TEXT NOT NULL,
    "attacker_id" TEXT NOT NULL,
    "defender_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "rating_change" INTEGER NOT NULL,
    "reward_gold" INTEGER NOT NULL DEFAULT 0,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pvp_battles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_companions_player_id_idx" ON "player_companions"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_companions_player_id_template_id_key" ON "player_companions"("player_id", "template_id");

-- CreateIndex
CREATE INDEX "boss_attempts_player_id_idx" ON "boss_attempts"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "boss_attempts_player_id_boss_id_key" ON "boss_attempts"("player_id", "boss_id");

-- CreateIndex
CREATE UNIQUE INDEX "pvp_profiles_player_id_key" ON "pvp_profiles"("player_id");

-- CreateIndex
CREATE INDEX "pvp_profiles_rating_idx" ON "pvp_profiles"("rating" DESC);

-- CreateIndex
CREATE INDEX "pvp_battles_attacker_id_created_at_idx" ON "pvp_battles"("attacker_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pvp_battles_defender_id_idx" ON "pvp_battles"("defender_id");

-- AddForeignKey
ALTER TABLE "player_companions" ADD CONSTRAINT "player_companions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_attempts" ADD CONSTRAINT "boss_attempts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pvp_profiles" ADD CONSTRAINT "pvp_profiles_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pvp_battles" ADD CONSTRAINT "pvp_battles_attacker_id_fkey" FOREIGN KEY ("attacker_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pvp_battles" ADD CONSTRAINT "pvp_battles_defender_id_fkey" FOREIGN KEY ("defender_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
