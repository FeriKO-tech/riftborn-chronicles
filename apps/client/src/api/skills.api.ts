import type { SkillStateDto, SkillUpgradeResponseDto } from '@riftborn/shared';
import { apiClient } from './client';

export const skillsApi = {
  getState: async (): Promise<SkillStateDto> => {
    const { data } = await apiClient.get<{ data: SkillStateDto }>('/skills');
    return data.data;
  },
  upgrade: async (skillId: string): Promise<SkillUpgradeResponseDto> => {
    const { data } = await apiClient.post<{ data: SkillUpgradeResponseDto }>(`/skills/${skillId}/upgrade`);
    return data.data;
  },
};
