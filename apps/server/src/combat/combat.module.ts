import { Module } from '@nestjs/common';
import { CombatService } from './combat.service';

@Module({
  providers: [CombatService],
  exports: [CombatService],
})
export class CombatModule {}
