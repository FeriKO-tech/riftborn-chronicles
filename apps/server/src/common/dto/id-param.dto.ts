import { IsString, IsNotEmpty } from 'class-validator';

export class ItemIdDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;
}

export class TemplateIdDto {
  @IsString()
  @IsNotEmpty()
  templateId!: string;
}

export class OpponentIdDto {
  @IsString()
  @IsNotEmpty()
  opponentPlayerId!: string;
}
