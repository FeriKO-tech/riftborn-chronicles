import { apiClient } from './client';
import type {
  ApiSuccess,
  AuthResponseDto,
  LoginRequestDto,
  PlayerStateDto,
  RefreshResponseDto,
  RegisterRequestDto,
} from '@riftborn/shared';

export const authApi = {
  register: async (dto: RegisterRequestDto): Promise<AuthResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<AuthResponseDto>>('/auth/register', dto);
    return data.data;
  },

  login: async (dto: LoginRequestDto): Promise<AuthResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<AuthResponseDto>>('/auth/login', dto);
    return data.data;
  },

  refresh: async (): Promise<RefreshResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<RefreshResponseDto>>('/auth/refresh');
    return data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<PlayerStateDto> => {
    const { data } = await apiClient.get<ApiSuccess<PlayerStateDto>>('/auth/me');
    return data.data;
  },
};
