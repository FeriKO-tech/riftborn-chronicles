import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stagesApi } from '../api/stages.api';
import { usePlayerStore } from '../store/player.store';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from './usePlayerQuery';

export const STAGE_PROGRESS_KEY = ['stage', 'progress'] as const;

export function useStageProgress() {
  return useQuery({
    queryKey: STAGE_PROGRESS_KEY,
    queryFn: () => stagesApi.getMyProgress(),
  });
}

export function useAdvanceRoom() {
  const qc = useQueryClient();
  const updateCurrencies = usePlayerStore((s) => s.updateCurrencies);

  return useMutation({
    mutationFn: () => stagesApi.advanceRoom(),
    onSuccess: (result) => {
      // Invalidate stage progress so it refetches
      void qc.invalidateQueries({ queryKey: STAGE_PROGRESS_KEY });

      if (result.victory) {
        // Patch currency store immediately (optimistic)
        const cur = usePlayerStore.getState().playerState?.currencies;
        if (cur) {
          updateCurrencies({ ...cur, goldShards: cur.goldShards + result.goldEarned });
        }
        // Invalidate full player state to pick up level/exp changes
        void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });

        const parts = [`⚔️ Victory! +${result.goldEarned.toLocaleString()} 🟡 +${result.expEarned.toLocaleString()} XP`];
        if (result.leveledUp) parts.push(`🆙 Level ${result.newLevel}!`);
        if (result.zoneCleared) parts.push(`🗺️ Zone cleared!`);
        notify.success(parts.join('  '), 4000);

        if (result.drop.dropped && result.drop.item) {
          notify.loot(`📦 ${result.drop.item.name} dropped!`);
        }
      } else {
        notify.error('💀 Defeated — try again!');
      }
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Battle failed';
      // ForbiddenException: under-leveled
      if (message.includes('requires level')) {
        notify.warning(`⚠️ ${message}`);
      } else {
        notify.error(message);
      }
    },
  });
}
