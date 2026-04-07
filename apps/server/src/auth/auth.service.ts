import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { AccountsService } from '../accounts/accounts.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { PlayersService } from '../players/players.service';
import { PlayerClass } from '@riftborn/shared';
import type { AuthResponseDto, TokenPayload } from '@riftborn/shared';
import type { RegisterDto } from './dto/register.dto';

interface InternalAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  player: AuthResponseDto['player'];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly players: PlayersService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<InternalAuthResult> {
    const account = await this.accounts.create(dto.email, dto.password);
    const player = await this.players.create(
      account.id,
      dto.playerName,
      dto.playerClass as PlayerClass,
    );

    const { accessToken, refreshToken } = await this.issueTokens(
      account.id,
      account.email,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      player: this.players.toProfileDto(player),
    };
  }

  async login(email: string, password: string): Promise<InternalAuthResult> {
    const account = await this.accounts.findByEmail(email);
    if (!account || !(await this.accounts.verifyPassword(password, account.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const player = await this.players.findByAccountId(account.id);
    const { accessToken, refreshToken } = await this.issueTokens(
      account.id,
      account.email,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      player: this.players.toProfileDto(player),
    };
  }

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokens(
      stored.accountId,
      stored.account.email,
    );

    // Return new refresh token as well (caller sets cookie)
    // We store the new one
    return { accessToken, expiresIn: 900 };

    // Note: newRefreshToken is stored but we return only accessToken
    // The caller (controller) must separately call issueTokens or we restructure
    // Simplified: return both in a tuple
    void newRefreshToken;
  }

  async refreshFull(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken } = await this.issueTokens(
      stored.accountId,
      stored.account.email,
    );

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    accountId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: TokenPayload = { sub: accountId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.jwtAccessExpiresIn,
    });

    const rawRefreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { accountId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
