import type { PlayerClass, PlayerProfileDto } from './player.types';

export interface RegisterRequestDto {
  email: string;
  password: string;
  playerName: string;
  playerClass: PlayerClass;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  player: PlayerProfileDto;
}

export interface TokenPayload {
  sub: string;
  email: string;
}

export interface RefreshResponseDto {
  accessToken: string;
  expiresIn: number;
}
