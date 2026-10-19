/** 진동 피드백 (Android 앱에서만, 실패해도 무시) */
import { isNative } from './platform.ts';

export async function haptic(kind: 'light' | 'medium' | 'success' = 'light'): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    /* 진동을 지원하지 않는 기기 */
  }
}
