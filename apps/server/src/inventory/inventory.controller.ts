import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { EquipResponseDto, InventoryItemDto, UnequipResponseDto, TokenPayload } from '@riftborn/shared';
import { PlayersService } from '../players/players.service';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly playersService: PlayersService,
  ) {}

  @Get()
  async getInventory(@CurrentPlayer() payload: TokenPayload): Promise<InventoryItemDto[]> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.inventoryService.getInventory(player.id);
  }

  @Post('equip/:itemId')
  @HttpCode(HttpStatus.OK)
  async equip(
    @CurrentPlayer() payload: TokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<EquipResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.inventoryService.equip(player.id, itemId);
  }

  @Delete('equip/:itemId')
  @HttpCode(HttpStatus.OK)
  async unequip(
    @CurrentPlayer() payload: TokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<UnequipResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.inventoryService.unequip(player.id, itemId);
  }
}
