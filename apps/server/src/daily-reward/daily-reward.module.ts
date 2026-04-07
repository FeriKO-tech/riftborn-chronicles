import { Module } from '@nestjs/common';
import { PlayersModule } from '../players/players.module';
import { DailyRewardController } from './daily-reward.controller';
import { DailyRewardService } from './daily-reward.service';

@Module({
  imports: [PlayersModule],
  controllers: [DailyRewardController],
  providers: [DailyRewardService],
  exports: [DailyRewardService],
})
export class DailyRewardModule {}
