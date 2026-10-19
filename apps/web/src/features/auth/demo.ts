import { DEMO_PASSWORD } from '@runhigh/core';
import { api } from '../../api/client.ts';
import { LocalApi } from '../../api/local.ts';
import { useSession } from '../../api/session.ts';

export const isDemo = api instanceof LocalApi;

/** 데모 계정으로 로그인 (데모 모드 전용) */
export async function loginDemo(email = 'demo@runhigh.app') {
  const res = await api.call('auth.login', { email, password: DEMO_PASSWORD });
  useSession.getState().setMe(res.user);
  return res.user;
}
