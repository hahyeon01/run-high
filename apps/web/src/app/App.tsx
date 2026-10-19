import { isApiError } from '../api/errors.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { api, switchMode } from '../api/client.ts';
import { LocalApi } from '../api/local.ts';
import { useSession } from '../api/session.ts';
import { Button } from '../components/Button.tsx';
import { LogoMark } from '../components/Logo.tsx';
import { Toaster } from '../components/Toaster.tsx';
import { initNative } from '../native/init.ts';
import { syncReminders } from '../native/reminders.ts';
import { router } from './routes.tsx';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: (count, err) => isApiError(err, 'NETWORK') && count < 2, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand text-white">
      <div className="rounded-[22px] bg-white/10 p-3">
        <LogoMark size={64} />
      </div>
      <p className="text-[15px] text-white/80">러닝 기록을 불러오는 중…</p>
    </div>
  );
}

function Offline({ message }: { message: string }) {
  const bootstrap = useSession((s) => s.bootstrap);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <LogoMark size={56} />
      <h1 className="mt-2 text-[20px] font-bold">서버에 연결할 수 없어요</h1>
      <p className="max-w-sm text-[14px] text-ink-2">{message}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={() => void bootstrap()}>
          다시 시도
        </Button>
        <Button variant="secondary" onClick={() => switchMode({ kind: 'local' })}>
          데모 모드로 열기
        </Button>
      </div>
    </div>
  );
}

export function App() {
  const status = useSession((s) => s.status);
  const error = useSession((s) => s.error);
  const bootstrap = useSession((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    void initNative();
    if (api instanceof LocalApi) {
      api.startJobs(() => void queryClient.invalidateQueries({ queryKey: ['notifications.unreadCount'] }));
    }
  }, [bootstrap]);

  useEffect(() => {
    if (status === 'authed') void syncReminders();
  }, [status]);

  if (status === 'loading') return <Splash />;
  if (status === 'offline') return <Offline message={error ?? ''} />;
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
