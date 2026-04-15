import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { PlayersService } from '../players/players.service';
import type { EnhanceItemResponseDto, EnhancementInfoDto, TokenPayload } from '@riftborn/shared';
import { ItemIdDto } from '../common/dto/id-param.dto';
import { EnhancementService } from './enhancement.service';

@Controller('enhancement')
export class EnhancementController {
  constructor(
    private readonly enhancementService: EnhancementService,
    private readonly playersService: PlayersService,
  ) {}

  @Get('item/:itemId')
  async getInfo(
    @CurrentPlayer() payload: TokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<EnhancementInfoDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.enhancementService.getEnhancementInfo(player.id, itemId);
  }

  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  async upgrade(
    @CurrentPlayer() payload: TokenPayload,
    @Body() body: ItemIdDto,
  ): Promise<EnhanceItemResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.enhancementService.upgradeItem(player.id, body.itemId);
  }
}
