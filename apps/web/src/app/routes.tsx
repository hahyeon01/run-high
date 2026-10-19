import { lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate, useLocation } from 'react-router';
import { useSession } from '../api/session.ts';
import { ListSkeleton } from '../components/Misc.tsx';
import { Shell } from './Shell.tsx';
import { Welcome } from '../features/auth/Welcome.tsx';
import { Login } from '../features/auth/Login.tsx';
import { Home } from '../features/home/Home.tsx';
import { FeedPage } from '../features/feed/FeedPage.tsx';
import { FlashList } from '../features/flash/FlashList.tsx';
import { CrewList } from '../features/crews/CrewList.tsx';
import { RaceList } from '../features/races/RaceList.tsx';
import { MyPage } from '../features/me/MyPage.tsx';

const Signup = lazy(() => import('../features/auth/Signup.tsx'));
const PostDetail = lazy(() => import('../features/feed/PostDetail.tsx'));
const NewPost = lazy(() => import('../features/feed/NewPost.tsx'));
const FlashDetail = lazy(() => import('../features/flash/FlashDetail.tsx'));
const CreateFlash = lazy(() => import('../features/flash/CreateFlash.tsx'));
const CrewDetail = lazy(() => import('../features/crews/CrewDetail.tsx'));
const CreateCrew = lazy(() => import('../features/crews/CreateCrew.tsx'));
const RaceDetail = lazy(() => import('../features/races/RaceDetail.tsx'));
const RaceCalendar = lazy(() => import('../features/races/RaceCalendar.tsx'));
const RecordsPage = lazy(() => import('../features/records/RecordsPage.tsx'));
const AddRecord = lazy(() => import('../features/records/AddRecord.tsx'));
const TrackRun = lazy(() => import('../features/records/TrackRun.tsx'));
const RecordDetail = lazy(() => import('../features/records/RecordDetail.tsx'));
const Notifications = lazy(() => import('../features/notifications/Notifications.tsx'));
const UserProfile = lazy(() => import('../features/me/UserProfile.tsx'));
const EditProfile = lazy(() => import('../features/me/EditProfile.tsx'));
const Settings = lazy(() => import('../features/me/Settings.tsx'));
const VerifyPhone = lazy(() => import('../features/me/VerifyPhone.tsx'));
const MyActivity = lazy(() => import('../features/me/MyActivity.tsx'));
const Admin = lazy(() => import('../features/admin/Admin.tsx'));
const RaceForm = lazy(() => import('../features/admin/RaceForm.tsx'));
const Docs = lazy(() => import('../features/docs/Docs.tsx'));

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-4 pt-16">
          <ListSkeleton rows={3} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  const location = useLocation();
  if (status !== 'authed') return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useSession((s) => s.me);
  if (me?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  if (status === 'authed') return <Navigate to="/" replace />;
  return <>{children}</>;
}

const l = (node: ReactNode) => <Lazy>{node}</Lazy>;

export const router = createHashRouter([
  { path: '/welcome', element: <PublicOnly><Welcome /></PublicOnly> },
  { path: '/login', element: <PublicOnly><Login /></PublicOnly> },
  { path: '/signup', element: <PublicOnly>{l(<Signup />)}</PublicOnly> },
  { path: '/docs/:doc', element: l(<Docs />) },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Shell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'feed', element: <FeedPage /> },
      { path: 'feed/new', element: l(<NewPost />) },
      { path: 'posts/:id', element: l(<PostDetail />) },
      { path: 'flash', element: <FlashList /> },
      { path: 'flash/new', element: l(<CreateFlash />) },
      { path: 'flash/:id', element: l(<FlashDetail />) },
      { path: 'crews', element: <CrewList /> },
      { path: 'crews/new', element: l(<CreateCrew />) },
      { path: 'crews/:id', element: l(<CrewDetail />) },
      { path: 'races', element: <RaceList /> },
      { path: 'races/calendar', element: l(<RaceCalendar />) },
      { path: 'races/:id', element: l(<RaceDetail />) },
      { path: 'records', element: l(<RecordsPage />) },
      { path: 'records/new', element: l(<AddRecord />) },
      { path: 'records/track', element: l(<TrackRun />) },
      { path: 'records/:id', element: l(<RecordDetail />) },
      { path: 'notifications', element: l(<Notifications />) },
      { path: 'me', element: <MyPage /> },
      { path: 'me/edit', element: l(<EditProfile />) },
      { path: 'me/activity', element: l(<MyActivity />) },
      { path: 'users/:id', element: l(<UserProfile />) },
      { path: 'settings', element: l(<Settings />) },
      { path: 'verify', element: l(<VerifyPhone />) },
      { path: 'admin', element: <RequireAdmin>{l(<Admin />)}</RequireAdmin> },
      { path: 'admin/races/new', element: <RequireAdmin>{l(<RaceForm />)}</RequireAdmin> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
