import React from 'react';
import { useAuthStore } from '../store/auth.store';
import { usePlayerStore } from '../store/player.store';
import { queryClient } from '../providers/QueryProvider';

interface NavItem {
  icon: string;
  label: string;
  id: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: '⚔️', label: 'Battle', id: 'battle' },
  { icon: '👤', label: 'Hero', id: 'hero' },
  { icon: '🏪', label: 'Shop', id: 'shop' },
  { icon: '☠️', label: 'Boss', id: 'boss' },
  { icon: '🏆', label: 'PvP', id: 'pvp' },
  { icon: '📋', label: 'Quests', id: 'quests' },
  { icon: '✨', label: 'Skills', id: 'skills' },
  { icon: '🏅', label: 'Rank', id: 'leaderboard' },
  { icon: '🎖️', label: 'Achieve', id: 'achievements' },
  { icon: '⚙️', label: 'Menu', id: 'menu' },
];

interface Props {
  activeTab: string;
  onTab: (id: string) => void;
  questsReady?: number;
}

const bar: React.CSSProperties = {
  width: '100%',
  height: '56px',
  background: 'rgba(13,8,33,0.95)',
  borderTop: '1px solid rgba(167,139,250,0.15)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
};

const item = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  cursor: 'pointer',
  padding: '4px 12px',
  borderRadius: '8px',
  opacity: active ? 1 : 0.55,
  transition: 'opacity 0.15s',
  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
  position: 'relative',
});

export default function NavBar({ activeTab, onTab, questsReady }: Props) {
  const logout = useAuthStore((s) => s.logout);
  const clearPlayer = usePlayerStore((s) => s.clear);

  const handleLogout = async () => {
    await logout();
    clearPlayer();
    queryClient.clear();
  };

  return (
    <div style={bar}>
      {NAV_ITEMS.map(({ icon, label, id }) => (
        <div
          key={id}
          style={item(activeTab === id)}
          onClick={id === 'menu' ? handleLogout : () => onTab(id)}
          title={id === 'menu' ? 'Logout' : label}
        >
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <span style={{ fontSize: '10px', color: activeTab === id ? '#a78bfa' : '#6b7280' }}>
            {id === 'menu' ? 'Logout' : label}
          </span>
          {id === 'quests' && questsReady != null && questsReady > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 8,
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#4ade80', fontSize: '8px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0d0821',
            }}>
              {questsReady}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
