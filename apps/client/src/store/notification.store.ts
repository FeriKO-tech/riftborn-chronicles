import { create } from 'zustand';

export type NotificationVariant = 'success' | 'error' | 'info' | 'warning' | 'loot';

export interface Notification {
  id: string;
  message: string;
  variant: NotificationVariant;
  duration: number;
}

interface NotificationState {
  notifications: Notification[];
  push: (message: string, variant?: NotificationVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

let _seq = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  push: (message, variant = 'info', duration = 3500) => {
    const id = `notif-${++_seq}`;
    set((s) => ({ notifications: [...s.notifications, { id, message, variant, duration }] }));
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    }, duration);
  },

  dismiss: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));

/** Convenience: call outside React components (e.g. in API interceptors) */
export const notify = {
  success: (msg: string, duration?: number) =>
    useNotificationStore.getState().push(msg, 'success', duration),
  error: (msg: string, duration?: number) =>
    useNotificationStore.getState().push(msg, 'error', duration),
  info: (msg: string, duration?: number) =>
    useNotificationStore.getState().push(msg, 'info', duration),
  warning: (msg: string, duration?: number) =>
    useNotificationStore.getState().push(msg, 'warning', duration),
  loot: (msg: string, duration?: number) =>
    useNotificationStore.getState().push(msg, 'loot', duration ?? 4000),
};
