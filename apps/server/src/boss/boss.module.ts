import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlayersModule } from '../players/players.module';
import { QuestModule } from '../quests/quest.module';
import { BossController } from './boss.controller';
import { BossService } from './boss.service';

@Module({
  imports: [CombatModule, InventoryModule, PlayersModule, QuestModule],
  controllers: [BossController],
  providers: [BossService],
  exports: [BossService],
})
export class BossModule {}
