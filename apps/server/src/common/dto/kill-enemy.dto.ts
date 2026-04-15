import { IsInt, IsString, IsNotEmpty, Min } from 'class-validator';

export class KillEnemyDto {
  @IsInt()
  @Min(1)
  zone!: number;

  @IsString()
  @IsNotEmpty()
  enemyTypeId!: string;
}
