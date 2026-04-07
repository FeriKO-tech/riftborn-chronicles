import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PlayersModule } from '../players/players.module';
import { QuestModule } from '../quests/quest.module';
import { EnhancementController } from './enhancement.controller';
import { EnhancementService } from './enhancement.service';

@Module({
  imports: [InventoryModule, PlayersModule, QuestModule],
  controllers: [EnhancementController],
  providers: [EnhancementService],
  exports: [EnhancementService],
})
export class EnhancementModule {}
