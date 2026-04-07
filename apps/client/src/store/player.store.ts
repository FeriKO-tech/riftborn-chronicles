import { create } from 'zustand';
import type { PlayerCurrenciesDto, PlayerStateDto, StageProgressDto } from '@riftborn/shared';

interface PlayerStoreState {
  playerState: PlayerStateDto | null;
  isLoading: boolean;
  setPlayerState: (state: PlayerStateDto) => void;
  updateCurrencies: (currencies: PlayerCurrenciesDto) => void;
  updateStageProgress: (progress: StageProgressDto) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  playerState: null,
  isLoading: false,

  setPlayerState: (playerState) => set({ playerState }),

  updateCurrencies: (currencies) =>
    set((s) =>
      s.playerState ? { playerState: { ...s.playerState, currencies } } : s,
    ),

  updateStageProgress: (stageProgress) =>
    set((s) =>
      s.playerState ? { playerState: { ...s.playerState, stageProgress } } : s,
    ),

  clear: () => set({ playerState: null }),
}));
