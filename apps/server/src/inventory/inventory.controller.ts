import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type {
  EquipResponseDto,
  InventoryItemDto,
  UnequipResponseDto,
  SalvageResponseDto,
  EnchantItemResponseDto,
  TokenPayload,
} from '@riftborn/shared';
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

  @Post('salvage/:itemId')
  @HttpCode(HttpStatus.OK)
  async salvage(
    @CurrentPlayer() payload: TokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<SalvageResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.inventoryService.salvageItem(player.id, itemId);
  }

  @Post('lock/:itemId')
  @HttpCode(HttpStatus.OK)
  async toggleLock(
    @CurrentPlayer() payload: TokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<InventoryItemDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.inventoryService.toggleLock(player.id, itemId);
  }

  @Post('enchant/:itemId')
  @HttpCode(HttpStatus.OK)
  async enchant(
    @CurrentPlayer() payload: TokenPayload,
    @Param('itemId') itemId: string,
  ): Promise<EnchantItemResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.inventoryService.enchantItem(player.id, itemId);
  }
}
