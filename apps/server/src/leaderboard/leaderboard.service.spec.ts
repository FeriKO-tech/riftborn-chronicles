import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  player: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns empty leaderboard when no players', async () => {
    mockPrisma.player.findMany.mockResolvedValue([]);
    mockPrisma.player.findUnique.mockResolvedValue({ powerScore: 0 });
    mockPrisma.player.count.mockResolvedValue(0);

    const result = await service.getTopPlayers('me-id');
    expect(result.entries).toEqual([]);
    expect(result.myRank).toBe(1);
  });

  it('returns ranked entries', async () => {
    mockPrisma.player.findMany.mockResolvedValue([
      { id: 'p1', name: 'Hero1', class: 'VOIDBLADE', level: 10, powerScore: 500n, stageProgress: { highestZone: 3 } },
      { id: 'p2', name: 'Hero2', class: 'AETHERMAGE', level: 5, powerScore: 300n, stageProgress: { highestZone: 2 } },
    ]);

    const result = await service.getTopPlayers('p1');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].name).toBe('Hero1');
    expect(result.entries[1].rank).toBe(2);
    expect(result.myRank).toBe(1);
  });
});
