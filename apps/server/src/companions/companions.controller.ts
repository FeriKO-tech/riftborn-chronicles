import { Controller, Get, HttpCode, HttpStatus, Post, Body } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { ActivateCompanionResponseDto, CompanionStateDto, CompanionTemplateDto, TokenPayload } from '@riftborn/shared';
import { PlayersService } from '../players/players.service';
import { CompanionsService } from './companions.service';

@Controller('companions')
export class CompanionsController {
  constructor(
    private readonly companionsService: CompanionsService,
    private readonly playersService: PlayersService,
  ) {}

  @Get()
  async getState(@CurrentPlayer() payload: TokenPayload): Promise<CompanionStateDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.companionsService.getState(player.id);
  }

  @Get('templates')
  getTemplates(): CompanionTemplateDto[] {
    return this.companionsService.getAvailableTemplates();
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @CurrentPlayer() payload: TokenPayload,
    @Body() body: { templateId: string },
  ): Promise<ActivateCompanionResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.companionsService.activate(player.id, body.templateId);
  }
}
