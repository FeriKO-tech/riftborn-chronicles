import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PlayersModule } from '../players/players.module';
import { CompanionsController } from './companions.controller';
import { CompanionsService } from './companions.service';

@Module({
  imports: [InventoryModule, PlayersModule],
  controllers: [CompanionsController],
  providers: [CompanionsService],
  exports: [CompanionsService],
})
export class CompanionsModule {}
