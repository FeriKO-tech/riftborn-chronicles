import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding development data...');

  // Clean slate for dev
  await prisma.offlineRewardLog.deleteMany();
  await prisma.stageProgress.deleteMany();
  await prisma.playerCurrencies.deleteMany();
  await prisma.player.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.account.deleteMany();

  console.log('Seed complete — database cleared for dev. Use the API to register accounts.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
