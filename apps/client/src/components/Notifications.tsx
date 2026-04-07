import React from 'react';
import type { NotificationVariant } from '../store/notification.store';
import { useNotificationStore } from '../store/notification.store';

const VARIANT_COLOR: Record<NotificationVariant, string> = {
  success: '#4ade80',
  error: '#f87171',
  info: '#60a5fa',
  warning: '#fbbf24',
  loot: '#c084fc',
};

const VARIANT_ICON: Record<NotificationVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
  loot: '📦',
};

const container: React.CSSProperties = {
  position: 'fixed',
  top: '60px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  zIndex: 999,
  pointerEvents: 'none',
};

export default function Notifications() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  return (
    <div style={container}>
      {notifications.map((n) => (
        <div
          key={n.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'rgba(13,8,33,0.95)',
            border: `1px solid ${VARIANT_COLOR[n.variant]}44`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            fontSize: '12px',
            color: '#e8e0ff',
            whiteSpace: 'nowrap',
            pointerEvents: 'all',
            cursor: 'pointer',
            animation: 'slideIn 0.2s ease',
          }}
          onClick={() => dismiss(n.id)}
        >
          <span style={{ color: VARIANT_COLOR[n.variant], fontWeight: 700 }}>
            {VARIANT_ICON[n.variant]}
          </span>
          {n.message}
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
