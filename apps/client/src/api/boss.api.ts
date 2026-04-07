import { apiClient } from './client';
import type {
  ApiSuccess,
  BossAttemptStatusDto,
  BossConfigDto,
  BossFightResponseDto,
} from '@riftborn/shared';

interface BossStateResponse {
  bosses: BossConfigDto[];
  attempts: Record<string, BossAttemptStatusDto>;
}

export const bossApi = {
  getState: async (): Promise<BossStateResponse> => {
    const { data } = await apiClient.get<ApiSuccess<BossStateResponse>>('/boss');
    return data.data;
  },

  fight: async (bossId: string): Promise<BossFightResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<BossFightResponseDto>>(
      `/boss/${bossId}/fight`,
    );
    return data.data;
  },
};
