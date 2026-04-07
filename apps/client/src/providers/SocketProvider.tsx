import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/auth.store';

// ── Event types pushed from server ────────────────────────────────────────────
export interface SocketEvents {
  'player:state-update': { type: 'player:state-update'; payload: Record<string, unknown> };
  'battle:result': { type: 'battle:result'; payload: Record<string, unknown> };
  'quest:progress': { type: 'quest:progress'; payload: { templateId: string; progress: number } };
  'notification': { type: 'notification'; payload: { message: string; variant: string } };
}

export type SocketEventType = keyof SocketEvents;
export type SocketEventPayload<T extends SocketEventType> = SocketEvents[T];
type AnyHandler = (payload: Record<string, unknown>) => void;

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SocketContextValue {
  status: SocketStatus;
  on: <T extends SocketEventType>(event: T, handler: (p: SocketEvents[T]) => void) => () => void;
  emit: (type: string, payload?: unknown) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_JITTER_MS = 500;

const WS_URL = (() => {
  const base = (import.meta.env['VITE_WS_URL'] as string | undefined);
  if (base) return base;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.hostname}:3001`;
})();

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<AnyHandler>>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: Record<string, unknown> };
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach((h) => h(msg));
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => setStatus('error');

    ws.onclose = () => {
      wsRef.current = null;
      if (intentionalClose.current) {
        setStatus('disconnected');
        return;
      }
      setStatus('disconnected');
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current) +
          Math.random() * RECONNECT_JITTER_MS,
        RECONNECT_MAX_MS,
      );
      reconnectAttemptRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, []);

  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  useEffect(() => {
    if (!isAuthenticated) {
      intentionalClose.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setStatus('disconnected');
      return;
    }
    intentionalClose.current = false;
    connect();
    return () => {
      intentionalClose.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect, isAuthenticated]);

  const on = useCallback(
    <T extends SocketEventType>(
      event: T,
      handler: (p: SocketEvents[T]) => void,
    ): (() => void) => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, new Set());
      }
      const h = handler as AnyHandler;
      handlersRef.current.get(event)!.add(h);
      return () => handlersRef.current.get(event)?.delete(h);
    },
    [],
  );

  const emit = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return (
    <SocketContext.Provider value={{ status, on, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be inside SocketProvider');
  return ctx;
}

/** Subscribe to a specific socket event. Cleans up automatically on unmount. */
export function useSocketEvent<T extends SocketEventType>(
  event: T,
  handler: (payload: SocketEvents[T]) => void,
  deps: React.DependencyList = [],
) {
  const { on } = useSocket();
  useEffect(() => {
    return on(event, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, on, ...deps]);
}
