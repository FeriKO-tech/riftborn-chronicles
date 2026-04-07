import { create } from 'zustand';
import type { PlayerProfileDto } from '@riftborn/shared';
import { configureAuthInterceptors } from '../api/client';
import { authApi } from '../api/auth.api';

interface AuthState {
  accessToken: string | null;
  player: PlayerProfileDto | null;
  isInitializing: boolean;
  setAuth: (token: string, player: PlayerProfileDto) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
  tryRestoreSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  player: null,
  isInitializing: true,

  setAuth: (accessToken, player) => set({ accessToken, player }),

  setToken: (accessToken) => set({ accessToken }),

  clearAuth: () => set({ accessToken: null, player: null }),

  tryRestoreSession: async () => {
    try {
      const { accessToken } = await authApi.refresh();
      const playerState = await authApi.getMe();
      set({ accessToken, player: playerState.profile });
    } catch {
      set({ accessToken: null, player: null });
    } finally {
      set({ isInitializing: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      get().clearAuth();
    }
  },
}));

// Wire Axios interceptors once — avoids circular dependency
configureAuthInterceptors(
  () => useAuthStore.getState().accessToken,
  (token) => useAuthStore.getState().setToken(token),
  () => {
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
  },
);
