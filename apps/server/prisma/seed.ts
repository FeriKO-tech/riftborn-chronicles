import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEV_EMAIL = 'dev@riftborn.dev';
const DEV_PASSWORD = 'DevPass123!';

async function main(): Promise<void> {
  console.log('🌱 Seeding development data...');

  await prisma.offlineRewardLog.deleteMany();
  await prisma.stageProgress.deleteMany();
  await prisma.playerCurrencies.deleteMany();
  await prisma.player.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.account.deleteMany();

  console.log('   ✓ Cleared existing data');

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const account = await prisma.account.create({
    data: {
      email: DEV_EMAIL,
      passwordHash,
      player: {
        create: {
          name: 'DevHero',
          class: 'VOIDBLADE',
          level: 5,
          lastHeartbeat: new Date(Date.now() - 3 * 3_600_000),
          currencies: {
            create: {
              goldShards: 50_000,
              voidCrystals: 250,
              resonanceCores: 1_000,
              forgeDust: 500,
              echoShards: 100,
              arenaMarks: 0,
              bossSeals: 3,
            },
          },
          stageProgress: {
            create: {
              currentZone: 3,
              currentRoom: 4,
              highestZone: 2,
            },
          },
        },
      },
    },
  });

  console.log(`   ✓ Created account:  ${account.email}`);
  console.log(`   ✓ Player:           DevHero (Voidblade, Lv5)`);
  console.log(`   ✓ Gold:             50,000  |  Crystals: 250  |  Cores: 1,000`);
  console.log(`   ✓ Stage progress:   Zone 3-4 (highest: 2)`);
  console.log(`   ✓ lastHeartbeat:    3h ago  →  offline reward modal will trigger`);
  console.log('');
  console.log(`🚀 Login: ${DEV_EMAIL}  /  ${DEV_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
