import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { PlayersModule } from '../players/players.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [CombatModule, PlayersModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
