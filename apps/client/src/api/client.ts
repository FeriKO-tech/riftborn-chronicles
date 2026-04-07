import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// Injected at runtime by configureAuthInterceptors — avoids circular dep with stores
let getToken: () => string | null = () => null;
let onTokenRefreshed: (token: string) => void = () => undefined;
let onAuthFailed: () => void = () => undefined;

export function configureAuthInterceptors(
  getter: () => string | null,
  onRefreshed: (token: string) => void,
  onFailed: () => void,
): void {
  getToken = getter;
  onTokenRefreshed = onRefreshed;
  onAuthFailed = onFailed;
}

// ── Request: attach access token ──────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response: auto-refresh on 401 ────────────────────────────────────────────
let isRefreshing = false;
let waitingQueue: Array<(newToken: string) => void> = [];

function drainQueue(token: string): void {
  waitingQueue.forEach((cb) => cb(token));
  waitingQueue = [];
}

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const cfg = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // Only retry on 401; skip the refresh and login endpoints themselves
    const isRefreshOrAuth =
      cfg?.url?.includes('/auth/refresh') || cfg?.url?.includes('/auth/login');

    if (status !== 401 || !cfg || cfg._retried || isRefreshOrAuth) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<unknown>((resolve) => {
        waitingQueue.push((token) => {
          cfg.headers['Authorization'] = `Bearer ${token}`;
          resolve(apiClient(cfg));
        });
      });
    }

    cfg._retried = true;
    isRefreshing = true;

    try {
      const { data } = await apiClient.post<{
        success: true;
        data: { accessToken: string; expiresIn: number };
      }>('/auth/refresh');

      const newToken = data.data.accessToken;
      onTokenRefreshed(newToken);
      drainQueue(newToken);

      cfg.headers['Authorization'] = `Bearer ${newToken}`;
      return apiClient(cfg);
    } catch (refreshErr) {
      waitingQueue = [];
      onAuthFailed();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
