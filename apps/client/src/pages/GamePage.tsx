import React, { useEffect, useRef, useState } from 'react';
import { useCombatScene } from '../hooks/useCombatScene';
import BattleHUD from '../components/BattleHUD';
import { useAuthStore } from '../store/auth.store';
import { usePlayerStore } from '../store/player.store';
import { dailyRewardApi } from '../api/daily-reward.api';
import { usePlayerState, useOfflineRewardPreview, useClaimOfflineReward } from '../hooks/usePlayerQuery';
import { useStageProgress } from '../hooks/useStageQuery';
import type { DailyRewardStatusDto } from '@riftborn/shared';
import { useSocketEvent } from '../providers/SocketProvider';
import { notify } from '../store/notification.store';
import GameLayout from '../components/GameLayout';
import HUD from '../components/HUD';
import NavBar from '../components/NavBar';
import OfflineRewardsModal from '../components/OfflineRewardsModal';
import HeroPanel from '../components/HeroPanel';
import DailyRewardModal from '../components/DailyRewardModal';
import QuestsPanel from '../components/QuestsPanel';
import StagesPanel from '../components/StagesPanel';
import BossPanel from '../components/BossPanel';
import PvpPanel from '../components/PvpPanel';
import ShopPanel from '../components/ShopPanel';

// ── Sub-panel styles (left / right sidebars) ──────────────────────────────────

const panelPad: React.CSSProperties = { padding: '12px' };

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: '8px',
};


// ── Sub-components ─────────────────────────────────────────────────────────────

function LeftPanel({ zoneName, kills, requiredKills, bossUnlocked, highestZone }: {
  zoneName: string;
  kills: number;
  requiredKills: number;
  bossUnlocked: boolean;
  highestZone: number | undefined;
}) {
  const pct = requiredKills > 0 ? Math.min(1, kills / requiredKills) : 0;
  return (
    <div style={panelPad}>
      <p style={sectionLabel}>Zone Progress</p>
      <div style={{
        background: 'rgba(124,58,237,0.1)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '12px',
      }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#e8e0ff', marginBottom: '10px' }}>
          {zoneName || 'Loading...'}
        </p>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kill Progress</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: bossUnlocked ? '#4ade80' : '#e8e0ff' }}>
              {kills} / {requiredKills}
            </span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct * 100}%`, borderRadius: '3px',
              background: bossUnlocked ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#7c3aed,#a855f7)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
        {bossUnlocked && (
          <p style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
            Boss Ready
          </p>
        )}
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
  autoBoss,
  onToggleAutoBoss,
  kills,
  requiredKills,
  zoneName,
}: {
  autoBoss: boolean;
  onToggleAutoBoss: () => void;
  kills: number;
  requiredKills: number;
  zoneName: string;
}) {
  return (
    <div style={{ ...panelPad, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={sectionLabel}>Auto-Combat</p>

      <button
        onClick={onToggleAutoBoss}
        style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          background: autoBoss
            ? 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(239,68,68,0.2))'
            : 'rgba(255,255,255,0.06)',
          color: autoBoss ? '#fbbf24' : '#9ca3af',
          boxShadow: autoBoss ? '0 0 16px rgba(245,158,11,0.25)' : 'none',
          transition: 'all 0.2s',
        }}
      >
        {autoBoss ? '⚔️ Auto-Boss ON' : '▶ Auto-Boss OFF'}
      </button>

      <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.6' }}>
        {autoBoss
          ? 'Automatically challenges the boss when kill goal is reached and advances to the next zone.'
          : 'Enable to auto-challenge bosses and progress through zones.'}
      </div>

      <div style={{
        background: 'rgba(124,58,237,0.08)', borderRadius: '8px',
        padding: '10px', fontSize: '11px', color: '#9ca3af',
      }}>
        <div style={{ marginBottom: '4px', color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zone Info</div>
        <div style={{ color: '#e8e0ff', fontWeight: 700, marginBottom: '2px' }}>{zoneName || '—'}</div>
        <div>Kills: <span style={{ color: kills >= requiredKills ? '#4ade80' : '#a78bfa', fontWeight: 700 }}>{kills}</span> / {requiredKills}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamePage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const profile = useAuthStore((s) => s.player);
  const combatScene = useCombatScene(
    canvasRef,
    profile?.class ?? 'VOIDBLADE',
    profile?.name ?? 'Hero',
  );

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: playerStateData } = usePlayerState();
  const { data: stageData } = useStageProgress();
  const { data: offlinePreview } = useOfflineRewardPreview();
  const claimOffline = useClaimOfflineReward();

  const authPlayer = useAuthStore((s) => s.player);
  const playerState = usePlayerStore((s) => s.playerState);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('battle');
  const [showHero, setShowHero] = useState(false);
  const [showBoss, setShowBoss] = useState(false);
  const [showPvp, setShowPvp] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showOfflineReward, setShowOfflineReward] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<DailyRewardStatusDto | null>(null);
  const [showDailyReward, setShowDailyReward] = useState(false);

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

  // ── Derived display values ─────────────────────────────────────────────────
  const displayProfile = playerStateData?.profile ?? authPlayer ?? null;
  const currencies = playerState?.currencies ?? playerStateData?.currencies ?? null;
  const progress = stageData;
  const questsReady = 0;

  const handleTab = (id: string) => {
    setActiveTab(id);
    if (id === 'hero') setShowHero(true);
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
            profile={displayProfile}
            currencies={currencies}
            currentZone={progress?.currentZone}
            currentRoom={progress?.currentRoom}
            questsReady={questsReady}
          />
        }
        left={
          <LeftPanel
            zoneName={combatScene.zoneName}
            kills={combatScene.kills}
            requiredKills={combatScene.requiredKills}
            bossUnlocked={combatScene.bossUnlocked}
            highestZone={progress?.highestZone}
          />
        }
        center={
          <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <BattleHUD
              zoneName={combatScene.zoneName}
              kills={combatScene.kills}
              requiredKills={combatScene.requiredKills}
              bossUnlocked={combatScene.bossUnlocked}
              bossActive={combatScene.bossActive}
              bossName={combatScene.bossName}
              zoneCleared={combatScene.zoneCleared}
              bossHpPercent={combatScene.bossHpPercent}
              heroHpPercent={combatScene.heroHpPercent}
              onBossClick={combatScene.triggerBoss}
            />
          </div>
        }
        right={
          <RightPanel
            autoBoss={combatScene.autoBoss}
            onToggleAutoBoss={combatScene.toggleAutoBoss}
            kills={combatScene.kills}
            requiredKills={combatScene.requiredKills}
            zoneName={combatScene.zoneName}
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

      {showHero && <HeroPanel onClose={() => { setShowHero(false); setActiveTab('battle'); }} />}
      {showBoss && <BossPanel onClose={() => { setShowBoss(false); setActiveTab('battle'); }} />}
      {showPvp && <PvpPanel onClose={() => { setShowPvp(false); setActiveTab('battle'); }} />}
      {showQuests && <QuestsPanel onClose={() => { setShowQuests(false); setActiveTab('battle'); }} />}
      {showStages && <StagesPanel onClose={() => { setShowStages(false); setActiveTab('battle'); }} />}
      {showShop && <ShopPanel onClose={() => { setShowShop(false); setActiveTab('battle'); }} />}
    </>
  );
}

