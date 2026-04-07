import React, { useEffect, useState } from 'react';
import { QuestPeriod } from '@riftborn/shared';
import type { PlayerQuestDto } from '@riftborn/shared';
import { questsApi } from '../api/quests.api';
import { usePlayerStore } from '../store/player.store';

interface Props {
  onClose: () => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 110,
  backdropFilter: 'blur(4px)',
};

const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.3)',
  borderRadius: '16px',
  padding: '24px',
  width: 'min(420px, 95vw)',
  maxHeight: '82vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

const progressFill = (pct: number): React.CSSProperties => ({
  height: '100%',
  width: `${Math.min(100, pct * 100).toFixed(1)}%`,
  background: pct >= 1 ? 'linear-gradient(90deg, #4ade80, #22c55e)' : 'linear-gradient(90deg, #7c3aed, #a855f7)',
  borderRadius: '3px',
  transition: 'width 0.4s ease',
});

function QuestCard({ quest, onClaim }: { quest: PlayerQuestDto; onClaim: (id: string) => Promise<void> }) {
  const [claiming, setClaiming] = useState(false);
  const pct = quest.targetValue > 0 ? quest.progress / quest.targetValue : 0;
  const canClaim = quest.completed && !quest.claimed;

  const handleClaim = async () => {
    setClaiming(true);
    try { await onClaim(quest.id); } finally { setClaiming(false); }
  };

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      marginBottom: '8px',
      background: quest.claimed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${canClaim ? 'rgba(74,222,128,0.4)' : quest.claimed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`,
      opacity: quest.claimed ? 0.5 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{quest.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: quest.claimed ? '#6b7280' : '#e8e0ff' }}>
            {quest.name}
            <span style={{ marginLeft: '6px', fontSize: '10px', color: '#6b7280' }}>
              {quest.period === QuestPeriod.DAILY ? '📅 Daily' : '📆 Weekly'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{quest.description}</div>
        </div>
        {canClaim && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            style={{
              padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer',
              background: 'rgba(74,222,128,0.25)', color: '#4ade80',
            }}
          >
            {claiming ? '…' : 'Claim'}
          </button>
        )}
        {quest.claimed && <span style={{ fontSize: '12px', color: '#4ade80' }}>✓</span>}
      </div>

      <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={progressFill(pct)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
        <span>{quest.progress.toLocaleString()} / {quest.targetValue.toLocaleString()}</span>
        <span style={{ color: '#f59e0b' }}>+{quest.goldReward.toLocaleString()} 🟡{quest.crystalReward > 0 ? ` +${quest.crystalReward} 💎` : ''}</span>
      </div>
    </div>
  );
}

export default function QuestsPanel({ onClose }: Props) {
  const [quests, setQuests] = useState<PlayerQuestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const updateCurrencies = usePlayerStore((s) => s.updateCurrencies);

  useEffect(() => {
    questsApi.getActiveQuests().then(setQuests).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleClaim = async (questId: string) => {
    const result = await questsApi.claimQuest(questId);
    setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, claimed: true } : q)));
    const cur = usePlayerStore.getState().playerState?.currencies;
    if (cur) {
      updateCurrencies({ ...cur, goldShards: result.newGoldBalance, voidCrystals: result.newCrystalBalance });
    }
  };

  const daily = quests.filter((q) => q.period === QuestPeriod.DAILY);
  const weekly = quests.filter((q) => q.period === QuestPeriod.WEEKLY);
  const readyToClaim = quests.filter((q) => q.completed && !q.claimed).length;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#e8e0ff' }}>
            📋 Quests{readyToClaim > 0 && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4ade80' }}>({readyToClaim} ready)</span>}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {loading && <p style={{ color: '#6b7280', fontSize: '13px' }}>Loading…</p>}

        {daily.length > 0 && (
          <>
            <p style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Daily Quests</p>
            {daily.map((q) => <QuestCard key={q.id} quest={q} onClaim={handleClaim} />)}
          </>
        )}

        {weekly.length > 0 && (
          <>
            <p style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase', marginTop: '12px', marginBottom: '8px' }}>Weekly Quests</p>
            {weekly.map((q) => <QuestCard key={q.id} quest={q} onClaim={handleClaim} />)}
          </>
        )}
      </div>
    </div>
  );
}
