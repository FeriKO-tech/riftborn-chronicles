import { apiClient } from './client';
import type {
  ActivateCompanionResponseDto,
  ApiSuccess,
  CompanionStateDto,
  CompanionTemplateDto,
} from '@riftborn/shared';

export const companionsApi = {
  getState: async (): Promise<CompanionStateDto> => {
    const { data } = await apiClient.get<ApiSuccess<CompanionStateDto>>('/companions');
    return data.data;
  },

  getTemplates: async (): Promise<CompanionTemplateDto[]> => {
    const { data } = await apiClient.get<ApiSuccess<CompanionTemplateDto[]>>('/companions/templates');
    return data.data;
  },

  activate: async (templateId: string): Promise<ActivateCompanionResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<ActivateCompanionResponseDto>>(
      '/companions/activate',
      { templateId },
    );
    return data.data;
  },
};
