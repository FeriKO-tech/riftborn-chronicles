import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { stagesApi } from '../api/stages.api';
import { useStageProgress } from '../hooks/useStageQuery';
import type { ZoneSummaryDto } from '@riftborn/shared';

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
  padding: '20px',
  width: 'min(480px, 95vw)',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

function zoneState(
  zone: ZoneSummaryDto,
  currentZone: number | undefined,
  highestZone: number | undefined,
): 'current' | 'completed' | 'unlocked' | 'locked' {
  if (!currentZone) return 'locked';
  if (zone.zone === currentZone) return 'current';
  if (highestZone && zone.zone <= highestZone) return 'completed';
  if (zone.zone <= currentZone) return 'unlocked';
  return 'locked';
}

const STATE_STYLE: Record<string, { borderColor: string; bg: string; badge: string; badgeColor: string }> = {
  current: { borderColor: '#a78bfa', bg: 'rgba(124,58,237,0.15)', badge: '▶ Current', badgeColor: '#a78bfa' },
  completed: { borderColor: 'rgba(74,222,128,0.3)', bg: 'rgba(74,222,128,0.05)', badge: '✓ Cleared', badgeColor: '#4ade80' },
  unlocked: { borderColor: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.03)', badge: 'Available', badgeColor: '#9ca3af' },
  locked: { borderColor: 'rgba(255,255,255,0.05)', bg: 'rgba(0,0,0,0.2)', badge: '🔒 Locked', badgeColor: '#4b5563' },
};

interface Props {
  onClose: () => void;
}

export default function StagesPanel({ onClose }: Props) {
  const { data: zones, isLoading } = useQuery({
    queryKey: ['stages', 'zones'],
    queryFn: () => stagesApi.listZones(),
    staleTime: 300_000,
  });
  const { data: progress } = useStageProgress();

  const currentZone = progress?.currentZone;
  const highestZone = progress?.highestZone;

  // Only show zones up to currentZone + 1 (preview next) or 100 if all unlocked
  const visibleZones = zones?.filter((z) => z.zone <= Math.min((currentZone ?? 1) + 1, 100)) ?? [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e8e0ff' }}>🗺️ Fracture Zones</span>
            {currentZone && (
              <span style={{ marginLeft: '10px', fontSize: '11px', color: '#6b7280' }}>
                Currently: Zone {currentZone}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {isLoading && <p style={{ color: '#6b7280', fontSize: '13px' }}>Loading zones…</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleZones.map((zone) => {
            const state = zoneState(zone, currentZone, highestZone);
            const style = STATE_STYLE[state];
            return (
              <div key={zone.zone} style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${style.borderColor}`,
                background: style.bg,
                opacity: state === 'locked' ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>Zone {zone.zone}</span>
                      <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: style.badgeColor }}>
                        {style.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: state === 'locked' ? '#4b5563' : '#e8e0ff', marginTop: '2px' }}>
                      {zone.name}
                    </p>
                    <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px' }}>
                      {zone.description}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#6b7280' }}>Min Lv</p>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: state === 'locked' ? '#4b5563' : '#f59e0b' }}>
                      {zone.minLevel}
                    </p>
                    <p style={{ fontSize: '9px', color: '#6b7280' }}>{zone.roomCount} rooms</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Hint: more zones locked */}
          {zones && visibleZones.length < zones.length && (
            <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: '#4b5563' }}>
              🔒 {zones.length - visibleZones.length} more zones locked — keep progressing
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
