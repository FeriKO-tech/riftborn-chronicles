import { apiClient } from './client';
import type {
  ApiSuccess,
  ClaimQuestResponseDto,
  PlayerQuestDto,
} from '@riftborn/shared';

export const questsApi = {
  getActiveQuests: async (): Promise<PlayerQuestDto[]> => {
    const { data } = await apiClient.get<ApiSuccess<PlayerQuestDto[]>>('/quests');
    return data.data;
  },

  claimQuest: async (questId: string): Promise<ClaimQuestResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<ClaimQuestResponseDto>>(
      `/quests/${questId}/claim`,
    );
    return data.data;
  },
};
