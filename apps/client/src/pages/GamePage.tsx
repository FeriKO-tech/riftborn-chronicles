import React, { useEffect, useRef, useState } from 'react';
import { usePixiApp } from '../game/usePixiApp';
import type { BattleSceneState } from '../game/usePixiApp';
import { useAuthStore } from '../store/auth.store';
import { usePlayerStore } from '../store/player.store';
import { dailyRewardApi } from '../api/daily-reward.api';
import { usePlayerState, useOfflineRewardPreview, useClaimOfflineReward } from '../hooks/usePlayerQuery';
import { useStageProgress, useAdvanceRoom } from '../hooks/useStageQuery';
import type { DailyRewardStatusDto } from '@riftborn/shared';
import { useSocketEvent } from '../providers/SocketProvider';
import { notify } from '../store/notification.store';
import GameLayout from '../components/GameLayout';
import HUD from '../components/HUD';
import NavBar from '../components/NavBar';
import OfflineRewardsModal from '../components/OfflineRewardsModal';
import InventoryPanel from '../components/InventoryPanel';
import DailyRewardModal from '../components/DailyRewardModal';
import QuestsPanel from '../components/QuestsPanel';
import StagesPanel from '../components/StagesPanel';
import CompanionsPanel from '../components/CompanionsPanel';
import BossPanel from '../components/BossPanel';
import PvpPanel from '../components/PvpPanel';
import ShopPanel from '../components/ShopPanel';

// ── Pure style helpers ─────────────────────────────────────────────────────────

const roomPip = (filled: boolean): React.CSSProperties => ({
  width: '20px',
  height: '6px',
  borderRadius: '3px',
  background: filled ? '#7c3aed' : 'rgba(255,255,255,0.08)',
  transition: 'background 0.2s',
});

// ── Sub-panel styles (left / right sidebars) ──────────────────────────────────

const panelPad: React.CSSProperties = { padding: '12px' };

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: '8px',
};

const battleBtn = (busy: boolean, type: 'primary' | 'auto' | 'speed', active?: boolean): React.CSSProperties => {
  if (type === 'primary') return {
    width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
    fontSize: '14px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
    background: busy ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#7c3aed,#a855f7)',
    color: busy ? '#6b7280' : '#fff',
  };
  if (type === 'auto') return {
    flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '12px',
    fontWeight: 700, cursor: 'pointer',
    background: active ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)',
    color: active ? '#f59e0b' : '#9ca3af',
  };
  return {
    padding: '8px 10px', borderRadius: '8px', border: 'none', fontSize: '10px',
    fontWeight: 600, cursor: 'pointer',
    background: active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)',
    color: active ? '#e8e0ff' : '#6b7280',
  };
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function LeftPanel({ zone, roomNum, zoneName, highestZone }: {
  zone: number | undefined;
  roomNum: number | undefined;
  zoneName: string | undefined;
  highestZone: number | undefined;
}) {
  return (
    <div style={panelPad}>
      <p style={sectionLabel}>Stage Progress</p>
      <div style={{
        background: 'rgba(124,58,237,0.1)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '12px',
      }}>
        <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
          Zone {zone ?? '—'}
        </p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#e8e0ff', marginBottom: '10px' }}>
          {zoneName ?? 'Loading…'}
        </p>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={roomPip((roomNum ?? 0) > i)} />
          ))}
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af' }}>
          Room {roomNum ?? '—'} / 10
          {roomNum === 10 ? <span style={{ color: '#f59e0b', marginLeft: '6px' }}>👑 Boss</span> : null}
          {roomNum === 5 ? <span style={{ color: '#a78bfa', marginLeft: '6px' }}>⭐ Elite</span> : null}
        </p>
      </div>

      {highestZone != null && highestZone > 0 && (
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          Best cleared: <span style={{ color: '#4ade80' }}>Zone {highestZone}</span>
        </div>
      )}
    </div>
  );
}

function RightPanel({
  isPending,
  lastBattleLog,
  autoBattle,
  battleSpeed,
  onBattle,
  onToggleAuto,
  onSpeed,
}: {
  isPending: boolean;
  lastBattleLog: Array<{ id: number; victory: boolean; gold: number; zone: number; room: number; leveledUp: boolean; drop: boolean }>;
  autoBattle: boolean;
  battleSpeed: number;
  onBattle: () => void;
  onToggleAuto: () => void;
  onSpeed: (ms: number) => void;
}) {
  const roomType =
    lastBattleLog[0]?.room === 10 ? '👑 Boss Room'
    : lastBattleLog[0]?.room === 5 ? '⭐ Elite'
    : '⚔️ Battle';

  return (
    <div style={{ ...panelPad, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={sectionLabel}>Combat</p>

      <button style={battleBtn(isPending, 'primary')} onClick={onBattle} disabled={isPending}>
        {isPending ? 'Fighting…' : roomType}
      </button>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button style={battleBtn(false, 'auto', autoBattle)} onClick={onToggleAuto}>
          {autoBattle ? '⏸ Auto ON' : '▶ Auto OFF'}
        </button>
        {([3000, 1500, 700] as const).map((ms) => (
          <button
            key={ms}
            style={battleBtn(false, 'speed', battleSpeed === ms)}
            onClick={() => onSpeed(ms)}
          >
            {ms === 3000 ? 'Slow' : ms === 1500 ? 'Norm' : 'Fast'}
          </button>
        ))}
      </div>

      {lastBattleLog.length > 0 && (
        <>
          <p style={{ ...sectionLabel, marginTop: '4px' }}>Recent Battles</p>
          <div style={{ fontSize: '10px' }}>
            {lastBattleLog.map((e) => (
              <div key={e.id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ color: e.victory ? '#4ade80' : '#f87171' }}>
                  {e.victory ? '✓' : '✗'} Z{e.zone}-R{e.room}
                  {e.leveledUp ? ' 🆙' : ''}{e.drop ? ' 📦' : ''}
                </span>
                <span style={{ color: '#f59e0b' }}>+{e.gold.toLocaleString()} 🟡</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamePage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneStateRef = useRef<BattleSceneState>({
    playerName: 'Hero', playerClass: 'VOIDBLADE', playerHpPct: 1,
    enemyName: 'Enemy', enemyHpPct: 1, battling: false,
  });
  usePixiApp(canvasRef, sceneStateRef);

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: playerStateData } = usePlayerState();
  const { data: stageData } = useStageProgress();
  const advanceRoom = useAdvanceRoom();
  const { data: offlinePreview } = useOfflineRewardPreview();
  const claimOffline = useClaimOfflineReward();

  // Zustand for auth identity (name, class — set at login, lightweight)
  const authPlayer = useAuthStore((s) => s.player);
  const playerState = usePlayerStore((s) => s.playerState);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('battle');
  const [showInventory, setShowInventory] = useState(false);
  const [showCompanions, setShowCompanions] = useState(false);
  const [showBoss, setShowBoss] = useState(false);
  const [showPvp, setShowPvp] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showOfflineReward, setShowOfflineReward] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<DailyRewardStatusDto | null>(null);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [autoBattle, setAutoBattle] = useState(false);
  const [battleSpeed, setBattleSpeed] = useState(1500);
  const [battleLog, setBattleLog] = useState<Array<{
    id: number; victory: boolean; gold: number; zone: number; room: number;
    leveledUp: boolean; drop: boolean;
  }>>([]);
  const logIdRef = useRef(0);
  const autoBattleRef = useRef(autoBattle);
  autoBattleRef.current = autoBattle;

  // ── Socket events ──────────────────────────────────────────────────────────
  useSocketEvent('notification', ({ payload }) => {
    const msg = String(payload.message ?? '');
    const v = String(payload.variant ?? 'info') as 'success' | 'error' | 'info';
    notify[v]?.(msg);
  });

  // ── On mount: daily reward check + heartbeat ────────────────────────────────
  useEffect(() => {
    dailyRewardApi.getStatus().then((dr) => {
      setDailyStatus(dr);
      if (dr.canClaim) setShowDailyReward(true);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Show offline reward modal when preview loads and there's gold to claim
    if (offlinePreview && offlinePreview.goldEarned > 0) {
      setShowOfflineReward(true);
    }
  }, [offlinePreview]);

  useEffect(() => {
    const id = setInterval(() => {
      // Heartbeat — fire-and-forget, keeps idle calc accurate
      import('../api/player.api').then(({ playerApi }) =>
        playerApi.heartbeat().catch(() => undefined),
      );
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Battle flow ────────────────────────────────────────────────────────────
  const handleBattle = () => {
    if (advanceRoom.isPending) return;
    advanceRoom.mutate(undefined, {
      onSuccess: (result) => {
        setBattleLog((prev) => [
          {
            id: ++logIdRef.current,
            victory: result.victory,
            gold: result.goldEarned,
            zone: result.newZone,
            room: result.newRoom,
            leveledUp: result.leveledUp,
            drop: result.drop.dropped,
          },
          ...prev.slice(0, 7),
        ]);
      },
    });
  };

  // Auto-battle interval
  useEffect(() => {
    if (!autoBattle) return;
    const id = setInterval(() => {
      if (autoBattleRef.current && !advanceRoom.isPending) handleBattle();
    }, battleSpeed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBattle, battleSpeed]);

  // ── Derived display values ─────────────────────────────────────────────────
  const profile = playerStateData?.profile ?? authPlayer ?? null;
  const currencies = playerState?.currencies ?? playerStateData?.currencies ?? null;
  const progress = stageData;
  const questsReady = 0; // incremented when QuestsPanel is open — placeholder

  // Sync scene state ref (read by PixiJS ticker every frame)
  sceneStateRef.current = {
    playerName: profile?.name ?? 'Hero',
    playerClass: profile?.class ?? 'VOIDBLADE',
    playerHpPct: 1,
    enemyName: progress?.currentRoom === 10 ? 'Zone Boss'
      : progress?.currentRoom === 5 ? 'Elite Guard'
      : `Z${progress?.currentZone ?? 1}-R${progress?.currentRoom ?? 1}`,
    enemyHpPct: 1,
    battling: advanceRoom.isPending,
  };

  const handleTab = (id: string) => {
    setActiveTab(id);
    if (id === 'hero') { setShowInventory(true); setShowCompanions(true); }
    if (id === 'boss') setShowBoss(true);
    if (id === 'pvp') setShowPvp(true);
    if (id === 'quests') setShowQuests(true);
    if (id === 'stages') setShowStages(true);
    if (id === 'shop') setShowShop(true);
  };

  return (
    <>
      <GameLayout
        topBar={
          <HUD
            profile={profile}
            currencies={currencies}
            currentZone={progress?.currentZone}
            currentRoom={progress?.currentRoom}
            questsReady={questsReady}
          />
        }
        left={
          <LeftPanel
            zone={progress?.currentZone}
            roomNum={progress?.currentRoom}
            zoneName={progress?.zoneInfo.name}
            highestZone={progress?.highestZone}
          />
        }
        center={<div ref={canvasRef} style={{ width: '100%', height: '100%' }} />}
        right={
          <RightPanel
            isPending={advanceRoom.isPending}
            lastBattleLog={battleLog}
            autoBattle={autoBattle}
            battleSpeed={battleSpeed}
            onBattle={handleBattle}
            onToggleAuto={() => setAutoBattle((v) => !v)}
            onSpeed={setBattleSpeed}
          />
        }
        bottomNav={
          <NavBar
            activeTab={activeTab}
            onTab={handleTab}
            questsReady={questsReady}
          />
        }
      />

      {/* Modals */}
      {showOfflineReward && offlinePreview && offlinePreview.goldEarned > 0 && (
        <OfflineRewardsModal
          preview={offlinePreview}
          onClaimed={() => { setShowOfflineReward(false); claimOffline.mutate(); }}
        />
      )}

      {showDailyReward && dailyStatus && (
        <DailyRewardModal
          status={dailyStatus}
          onClaimed={() => {
            setShowDailyReward(false);
            dailyRewardApi.getStatus().then(setDailyStatus).catch(() => undefined);
          }}
          onClose={() => setShowDailyReward(false)}
        />
      )}

      {showInventory && <InventoryPanel onClose={() => { setShowInventory(false); setActiveTab('battle'); }} />}
      {showCompanions && <CompanionsPanel onClose={() => { setShowCompanions(false); setActiveTab('battle'); }} />}
      {showBoss && <BossPanel onClose={() => { setShowBoss(false); setActiveTab('battle'); }} />}
      {showPvp && <PvpPanel onClose={() => { setShowPvp(false); setActiveTab('battle'); }} />}
      {showQuests && <QuestsPanel onClose={() => { setShowQuests(false); setActiveTab('battle'); }} />}
      {showStages && <StagesPanel onClose={() => { setShowStages(false); setActiveTab('battle'); }} />}
      {showShop && <ShopPanel onClose={() => { setShowShop(false); setActiveTab('battle'); }} />}
    </>
  );
}

