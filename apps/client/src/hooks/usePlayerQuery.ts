import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { playerApi } from '../api/player.api';
import { usePlayerStore } from '../store/player.store';
import { notify } from '../store/notification.store';
import type { PlayerStateDto } from '@riftborn/shared';

export const PLAYER_STATE_KEY = ['player', 'state'] as const;
export const PLAYER_STATS_KEY = ['player', 'stats'] as const;

export function usePlayerState() {
  const setPlayerState = usePlayerStore((s) => s.setPlayerState);

  return useQuery({
    queryKey: PLAYER_STATE_KEY,
    queryFn: async () => {
      const state = await authApi.getMe();
      setPlayerState(state);
      return state;
    },
  });
}

export function usePlayerStats() {
  return useQuery({
    queryKey: PLAYER_STATS_KEY,
    queryFn: () => playerApi.getMyStats(),
  });
}

export function useOfflineRewardPreview() {
  return useQuery({
    queryKey: ['player', 'offline-reward'],
    queryFn: () => playerApi.getOfflineRewardPreview(),
    staleTime: 5_000,
  });
}

export function useClaimOfflineReward() {
  const qc = useQueryClient();
  const updateCurrencies = usePlayerStore((s) => s.updateCurrencies);

  return useMutation({
    mutationFn: () => playerApi.claimOfflineReward(),
    onSuccess: (result) => {
      const cur = usePlayerStore.getState().playerState?.currencies;
      if (cur) updateCurrencies({ ...cur, goldShards: result.newGoldBalance });
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      notify.success(`+${result.goldEarned.toLocaleString()} 🟡 offline rewards claimed`);
    },
    onError: () => notify.error('Failed to claim offline reward'),
  });
}

export function invalidatePlayerState(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
}

// Helper: sync TanStack cache → Zustand after a mutation that returns PlayerStateDto
export function syncPlayerStateToStore(state: PlayerStateDto) {
  usePlayerStore.getState().setPlayerState(state);
}
