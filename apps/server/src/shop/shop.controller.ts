import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type {
  ShopCatalogDto,
  ShopFreePackResponseDto,
  ShopPurchaseRequestDto,
  ShopPurchaseResponseDto,
  ShopStateDto,
  TokenPayload,
} from '@riftborn/shared';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { PlayersService } from '../players/players.service';
import { ShopService } from './shop.service';

@Controller('shop')
export class ShopController {
  constructor(
    private readonly shop: ShopService,
    private readonly players: PlayersService,
  ) {}

  @Get('catalog')
  getCatalog(): ShopCatalogDto {
    return this.shop.getCatalog();
  }

  @Get('state')
  async getState(@CurrentPlayer() payload: TokenPayload): Promise<ShopStateDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.shop.getState(player.id);
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchase(
    @CurrentPlayer() payload: TokenPayload,
    @Body() dto: ShopPurchaseRequestDto,
  ): Promise<ShopPurchaseResponseDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.shop.purchase(player.id, dto.offerId);
  }

  @Post('claim-daily-free')
  @HttpCode(HttpStatus.OK)
  async claimFreePack(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<ShopFreePackResponseDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.shop.claimFreePack(player.id);
  }
}
