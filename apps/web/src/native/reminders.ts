/**
 * Android 로컬 알림 예약
 *  - 관심 대회 접수 오픈: 하루 전 · 10분 전 · 오픈 시각
 *  - 참여 확정된 번개: 시작 2시간 전
 * 앱을 닫아 두어도 OS가 알림을 띄웁니다. (웹에서는 앱 안 알림만 사용)
 */
import { api } from '../api/client.ts';
import { useSession } from '../api/session.ts';
import { isNative } from './platform.ts';

const DAY = 86_400_000;
const MIN = 60_000;

function hashId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h % 2_000_000_000) + 1;
}

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export async function syncReminders(): Promise<void> {
  if (!isNative || useSession.getState().status !== 'authed') return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    const [alerts, mine] = await Promise.all([api.call('races.upcomingAlerts', {}), api.call('flash.mine', {})]);
    const now = Date.now();
    const notifications: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean }; extra: { link: string } }[] = [];
    for (const a of alerts) {
      const opens = Date.parse(a.opensAt);
      const slots: [number, string][] = [
        [opens - DAY, `내일 ${hhmm(a.opensAt)} '${a.name}' 접수가 시작돼요`],
        [opens - 10 * MIN, `10분 뒤 '${a.name}' 접수가 시작돼요`],
        [opens, `지금 '${a.name}' 접수가 시작됐어요`],
      ];
      for (const [at, title] of slots) {
        if (at <= now + 5_000) continue;
        notifications.push({ id: hashId(`race:${a.marathonId}:${at}`), title, body: '런하이 · 접수 오픈 알림', schedule: { at: new Date(at), allowWhileIdle: true }, extra: { link: `/races/${a.marathonId}` } });
      }
    }
    for (const f of [...mine.joined, ...mine.hosting]) {
      if (f.my.participation?.status !== 'confirmed') continue;
      const at = Date.parse(f.startsAt) - 2 * 3_600_000;
      if (at <= now + 5_000) continue;
      notifications.push({
        id: hashId(`flash:${f.id}`),
        title: `곧 '${f.title}' 번개가 시작해요`,
        body: `${f.place.name} · ${hhmm(f.startsAt)} 시작`,
        schedule: { at: new Date(at), allowWhileIdle: true },
        extra: { link: `/flash/${f.id}` },
      });
    }
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    await LocalNotifications.removeAllListeners();
    await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const link = (e.notification.extra as { link?: string } | undefined)?.link;
      if (link) window.location.hash = `#${link}`;
    });
  } catch (e) {
    console.warn('[runhigh] 알림 예약 실패', e);
  }
}
