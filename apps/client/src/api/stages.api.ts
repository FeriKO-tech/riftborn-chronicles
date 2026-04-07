import { apiClient } from './client';
import type {
  ApiSuccess,
  BattleResultDto,
  StageProgressResponseDto,
  ZoneDto,
  ZoneSummaryDto,
} from '@riftborn/shared';

export const stagesApi = {
  listZones: async (): Promise<ZoneSummaryDto[]> => {
    const { data } = await apiClient.get<ApiSuccess<ZoneSummaryDto[]>>('/stages/zones');
    return data.data;
  },

  getZone: async (zone: number): Promise<ZoneDto> => {
    const { data } = await apiClient.get<ApiSuccess<ZoneDto>>(`/stages/zones/${zone}`);
    return data.data;
  },

  getMyProgress: async (): Promise<StageProgressResponseDto> => {
    const { data } = await apiClient.get<ApiSuccess<StageProgressResponseDto>>(
      '/stages/me/progress',
    );
    return data.data;
  },

  advanceRoom: async (): Promise<BattleResultDto> => {
    const { data } = await apiClient.post<ApiSuccess<BattleResultDto>>(
      '/stages/me/advance',
    );
    return data.data;
  },
};
