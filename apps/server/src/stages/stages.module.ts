import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { InventoryModule } from '../inventory/inventory.module';
import { QuestModule } from '../quests/quest.module';
import { PlayersModule } from '../players/players.module';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { CombatSceneService } from './combat-scene.service';

@Module({
  imports: [CombatModule, PlayersModule, InventoryModule, QuestModule],
  controllers: [StagesController],
  providers: [StagesService, CombatSceneService],
  exports: [StagesService, CombatSceneService],
})
export class StagesModule {}
