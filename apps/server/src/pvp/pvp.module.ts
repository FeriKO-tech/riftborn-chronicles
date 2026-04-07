import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlayersModule } from '../players/players.module';
import { PvpController } from './pvp.controller';
import { PvpService } from './pvp.service';

@Module({
  imports: [CombatModule, InventoryModule, PlayersModule],
  controllers: [PvpController],
  providers: [PvpService],
  exports: [PvpService],
})
export class PvpModule {}
