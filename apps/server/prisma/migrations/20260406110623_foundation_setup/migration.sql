-- CreateEnum
CREATE TYPE "PlayerClass" AS ENUM ('VOIDBLADE', 'AETHERMAGE', 'IRONVEIL');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "class" "PlayerClass" NOT NULL,
    "power_score" BIGINT NOT NULL DEFAULT 0,
    "experience" BIGINT NOT NULL DEFAULT 0,
    "vip_level" INTEGER NOT NULL DEFAULT 0,
    "vip_exp" INTEGER NOT NULL DEFAULT 0,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "login_streak" INTEGER NOT NULL DEFAULT 0,
    "total_playtime" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_currencies" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "gold_shards" BIGINT NOT NULL DEFAULT 500,
    "void_crystals" INTEGER NOT NULL DEFAULT 0,
    "resonance_cores" INTEGER NOT NULL DEFAULT 150,
    "forge_dust" INTEGER NOT NULL DEFAULT 0,
    "echo_shards" INTEGER NOT NULL DEFAULT 0,
    "arena_marks" INTEGER NOT NULL DEFAULT 0,
    "boss_seals" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_progress" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "current_zone" INTEGER NOT NULL DEFAULT 1,
    "current_room" INTEGER NOT NULL DEFAULT 1,
    "highest_zone" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_reward_logs" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "idle_hours" DECIMAL(6,2) NOT NULL,
    "gold_earned" BIGINT NOT NULL,
    "multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_reward_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_account_id_idx" ON "refresh_tokens"("account_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "players_account_id_key" ON "players"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_name_key" ON "players"("name");

-- CreateIndex
CREATE INDEX "players_name_idx" ON "players"("name");

-- CreateIndex
CREATE UNIQUE INDEX "player_currencies_player_id_key" ON "player_currencies"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_progress_player_id_key" ON "stage_progress"("player_id");

-- CreateIndex
CREATE INDEX "offline_reward_logs_player_id_claimed_at_idx" ON "offline_reward_logs"("player_id", "claimed_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_currencies" ADD CONSTRAINT "player_currencies_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_reward_logs" ADD CONSTRAINT "offline_reward_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
