import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PlayerClass } from '@riftborn/shared';
import { AuthService } from './auth.service';
import { AccountsService } from '../accounts/accounts.service';
import { PlayersService } from '../players/players.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';

// ── Shared stubs ─────────────────────────────────────────────────────────────

const HASHED_PW = bcrypt.hashSync('TestPass123!', 10);

const stubAccount = {
  id: 'acc-1',
  email: 'test@riftborn.dev',
  passwordHash: HASHED_PW,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stubPlayer = {
  id: 'player-1',
  accountId: 'acc-1',
  name: 'VoidSlayer',
  level: 1,
  class: 'VOIDBLADE',
  powerScore: { toNumber: () => 0 },
  vipLevel: 0,
  lastHeartbeat: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAccountsService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  verifyPassword: jest.fn(),
};

const mockPlayersService = {
  create: jest.fn(),
  findByAccountId: jest.fn(),
  toProfileDto: jest.fn(),
};

const mockPrisma = {
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockConfig = {
  jwtSecret: 'test-secret',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  bcryptRounds: 10,
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: PlayersService, useValue: mockPlayersService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AppConfigService, useValue: mockConfig },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
            signAsync: jest.fn().mockResolvedValue('mock-access-token'),
            verify: jest.fn().mockReturnValue({ sub: 'acc-1', email: stubAccount.email }),
            verifyAsync: jest.fn().mockResolvedValue({ sub: 'acc-1', email: stubAccount.email }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      email: 'test@riftborn.dev',
      password: 'TestPass123!',
      playerName: 'VoidSlayer',
      playerClass: PlayerClass.VOIDBLADE,
    };

    it('creates account + player and returns access token + profile', async () => {
      mockAccountsService.create.mockResolvedValue(stubAccount);
      mockPlayersService.create.mockResolvedValue(stubPlayer);
      mockPlayersService.toProfileDto.mockReturnValue({
        id: stubPlayer.id,
        name: stubPlayer.name,
        level: 1,
        class: PlayerClass.VOIDBLADE,
        powerScore: 0,
        vipLevel: 0,
        experience: 0,
        expToNextLevel: 100,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'hashed' });

      const result = await service.register(dto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.player.name).toBe('VoidSlayer');
      expect(mockAccountsService.create).toHaveBeenCalledWith(dto.email, dto.password);
      expect(mockPlayersService.create).toHaveBeenCalledWith(
        'acc-1',
        dto.playerName,
        dto.playerClass,
      );
    });

    it('throws ConflictException if email already exists', async () => {
      mockAccountsService.create.mockRejectedValue(
        new ConflictException('Email already in use'),
      );

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      mockAccountsService.findByEmail.mockResolvedValue(stubAccount);
      mockAccountsService.verifyPassword.mockResolvedValue(true);
      mockPlayersService.findByAccountId.mockResolvedValue(stubPlayer);
      mockPlayersService.toProfileDto.mockReturnValue({
        id: stubPlayer.id,
        name: stubPlayer.name,
        level: 1,
        class: PlayerClass.VOIDBLADE,
        powerScore: 0,
        vipLevel: 0,
        experience: 0,
        expToNextLevel: 100,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'hashed' });

      const result = await service.login(stubAccount.email, 'TestPass123!');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.player.name).toBe('VoidSlayer');
    });

    it('throws UnauthorizedException when email is not found', async () => {
      mockAccountsService.findByEmail.mockResolvedValue(null);

      await expect(service.login('noone@void.dev', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      mockAccountsService.findByEmail.mockResolvedValue(stubAccount);
      mockAccountsService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(stubAccount.email, 'WrongPass!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
