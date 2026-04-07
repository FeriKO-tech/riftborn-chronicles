import { apiClient } from './client';
import type {
  ApiSuccess,
  ClaimDailyRewardResponseDto,
  DailyRewardStatusDto,
} from '@riftborn/shared';

export const dailyRewardApi = {
  getStatus: async (): Promise<DailyRewardStatusDto> => {
    const { data } = await apiClient.get<ApiSuccess<DailyRewardStatusDto>>('/daily-reward');
    return data.data;
  },

  claim: async (): Promise<ClaimDailyRewardResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<ClaimDailyRewardResponseDto>>(
      '/daily-reward/claim',
    );
    return data.data;
  },
};
