import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { CompanionsModule } from '../companions/companions.module';
import { PlayersModule } from '../players/players.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [InventoryModule, CompanionsModule, PlayersModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
