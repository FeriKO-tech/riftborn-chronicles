import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PlayerClass } from '@riftborn/shared';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  playerName!: string;

  @IsEnum(PlayerClass)
  playerClass!: PlayerClass;
}
