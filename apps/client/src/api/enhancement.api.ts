import { apiClient } from './client';
import type { ApiSuccess, EnhanceItemResponseDto, EnhancementInfoDto } from '@riftborn/shared';

export const enhancementApi = {
  getInfo: async (itemId: string): Promise<EnhancementInfoDto> => {
    const { data } = await apiClient.get<ApiSuccess<EnhancementInfoDto>>(
      `/enhancement/item/${itemId}`,
    );
    return data.data;
  },

  upgrade: async (itemId: string): Promise<EnhanceItemResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<EnhanceItemResponseDto>>(
      '/enhancement/upgrade',
      { itemId },
    );
    return data.data;
  },
};
