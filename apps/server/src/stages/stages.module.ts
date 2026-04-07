import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { InventoryModule } from '../inventory/inventory.module';
import { QuestModule } from '../quests/quest.module';
import { PlayersModule } from '../players/players.module';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';

@Module({
  imports: [CombatModule, PlayersModule, InventoryModule, QuestModule],
  controllers: [StagesController],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
