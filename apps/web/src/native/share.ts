import { isNative } from './platform.ts';

/** 공유 시트 (Android: 기본 공유, 웹: Web Share API → 없으면 클립보드 복사) */
export async function shareText(title: string, text: string, url?: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (isNative) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'));
    return 'copied';
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'failed';
    try {
      await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'));
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
