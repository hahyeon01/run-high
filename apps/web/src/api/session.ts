import { create } from 'zustand';
import type { Me } from '@runhigh/core';
import { api } from './client.ts';
import { HttpApi } from './http.ts';
import { isApiError } from './errors.ts';

interface SessionState {
  status: 'loading' | 'anon' | 'authed' | 'offline';
  me: Me | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  setMe: (me: Me) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  me: null,
  error: null,
  async bootstrap() {
    if (!api.hasCredential()) {
      set({ status: 'anon', me: null });
      return;
    }
    try {
      const me = await api.call('auth.me', {});
      set({ status: 'authed', me, error: null });
    } catch (e) {
      if (isApiError(e, 'NETWORK')) set({ status: 'offline', error: e.message });
      else {
        api.logout();
        set({ status: 'anon', me: null });
      }
    }
  },
  setMe(me) {
    set({ status: 'authed', me });
  },
  async refreshMe() {
    if (get().status !== 'authed') return;
    try {
      set({ me: await api.call('auth.me', {}) });
    } catch {
      /* 무시 */
    }
  },
  logout() {
    api.logout();
    set({ status: 'anon', me: null });
  },
}));

if (api instanceof HttpApi) {
  api.onUnauthorized = () => useSession.setState({ status: 'anon', me: null });
}

/** 로그인된 화면에서만 사용 */
export function useMe(): Me {
  const me = useSession((s) => s.me);
  if (!me) throw new Error('로그인이 필요해요');
  return me;
}
