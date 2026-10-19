/**
 * 아이콘: 레퍼런스 디자인과 같은 Iconly 세트(react-iconly, curved)를 쓰고,
 * 러닝 앱에 필요한 몇 가지(번개, 닫기, 경로)는 같은 선 굵기로 직접 그렸습니다.
 */
import type { CSSProperties, ReactNode } from 'react';
// 아이콘별 모듈만 불러와 번들 크기를 줄임 (패키지 전체 번들은 500KB가 넘음)
import Activity from 'react-iconly/dist/Icons/Activity.mjs';
import AddUser from 'react-iconly/dist/Icons/AddUser.mjs';
import ArrowLeft from 'react-iconly/dist/Icons/ArrowLeft.mjs';
import ArrowRight from 'react-iconly/dist/Icons/ArrowRight.mjs';
import Calendar from 'react-iconly/dist/Icons/Calendar.mjs';
import Camera from 'react-iconly/dist/Icons/Camera.mjs';
import Chart from 'react-iconly/dist/Icons/Chart.mjs';
import Chat from 'react-iconly/dist/Icons/Chat.mjs';
import ChevronDown from 'react-iconly/dist/Icons/ChevronDown.mjs';
import ChevronRight from 'react-iconly/dist/Icons/ChevronRight.mjs';
import Danger from 'react-iconly/dist/Icons/Danger.mjs';
import Delete from 'react-iconly/dist/Icons/Delete.mjs';
import Discovery from 'react-iconly/dist/Icons/Discovery.mjs';
import Document from 'react-iconly/dist/Icons/Document.mjs';
import Download from 'react-iconly/dist/Icons/Download.mjs';
import Edit from 'react-iconly/dist/Icons/Edit.mjs';
import Filter2 from 'react-iconly/dist/Icons/Filter2.mjs';
import Heart from 'react-iconly/dist/Icons/Heart.mjs';
import Hide from 'react-iconly/dist/Icons/Hide.mjs';
import Home from 'react-iconly/dist/Icons/Home.mjs';
import Image from 'react-iconly/dist/Icons/Image.mjs';
import InfoCircle from 'react-iconly/dist/Icons/InfoCircle.mjs';
import Location from 'react-iconly/dist/Icons/Location.mjs';
import Lock from 'react-iconly/dist/Icons/Lock.mjs';
import Logout from 'react-iconly/dist/Icons/Logout.mjs';
import MoreCircle from 'react-iconly/dist/Icons/MoreCircle.mjs';
import Notification from 'react-iconly/dist/Icons/Notification.mjs';
import People from 'react-iconly/dist/Icons/People.mjs';
import Play from 'react-iconly/dist/Icons/Play.mjs';
import Plus from 'react-iconly/dist/Icons/Plus.mjs';
import Search from 'react-iconly/dist/Icons/Search.mjs';
import Send from 'react-iconly/dist/Icons/Send.mjs';
import Setting from 'react-iconly/dist/Icons/Setting.mjs';
import ShieldDone from 'react-iconly/dist/Icons/ShieldDone.mjs';
import ShieldFail from 'react-iconly/dist/Icons/ShieldFail.mjs';
import Show from 'react-iconly/dist/Icons/Show.mjs';
import Star from 'react-iconly/dist/Icons/Star.mjs';
import Swap from 'react-iconly/dist/Icons/Swap.mjs';
import TicketStar from 'react-iconly/dist/Icons/TicketStar.mjs';
import TickSquare from 'react-iconly/dist/Icons/TickSquare.mjs';
import TimeCircle from 'react-iconly/dist/Icons/TimeCircle.mjs';
import Upload from 'react-iconly/dist/Icons/Upload.mjs';
import User from 'react-iconly/dist/Icons/User.mjs';
import Wallet from 'react-iconly/dist/Icons/Wallet.mjs';

const ICONLY = {
  activity: Activity,
  addUser: AddUser,
  back: ArrowLeft,
  forward: ArrowRight,
  calendar: Calendar,
  camera: Camera,
  chart: Chart,
  chat: Chat,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  danger: Danger,
  delete: Delete,
  discovery: Discovery,
  document: Document,
  download: Download,
  edit: Edit,
  filter: Filter2,
  heart: Heart,
  hide: Hide,
  home: Home,
  image: Image,
  info: InfoCircle,
  location: Location,
  lock: Lock,
  logout: Logout,
  more: MoreCircle,
  bell: Notification,
  people: People,
  play: Play,
  plus: Plus,
  search: Search,
  send: Send,
  setting: Setting,
  shield: ShieldDone,
  shieldFail: ShieldFail,
  show: Show,
  star: Star,
  swap: Swap,
  ticket: TicketStar,
  tick: TickSquare,
  time: TimeCircle,
  upload: Upload,
  user: User,
  wallet: Wallet,
} as const;

type CustomName = 'bolt' | 'close' | 'route' | 'check' | 'gps' | 'dots';
export type IconName = keyof typeof ICONLY | CustomName;

interface IconProps {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

function Svg({ size, children, className, label }: { size: number; children: ReactNode; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

function custom(name: CustomName, size: number, filled: boolean, className?: string, label?: string) {
  switch (name) {
    case 'bolt':
      return (
        <Svg size={size} className={className} label={label}>
          <path
            d="M13.2 2.75 5.6 12.9c-.38.5-.02 1.2.6 1.2h4.5l-.98 6.4c-.1.67.75 1.03 1.15.48l7.6-10.15c.38-.5.02-1.2-.6-1.2h-4.5l.98-6.4c.1-.67-.75-1.03-1.15-.48Z"
            fill={filled ? 'currentColor' : 'none'}
          />
        </Svg>
      );
    case 'close':
      return (
        <Svg size={size} className={className} label={label}>
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </Svg>
      );
    case 'check':
      return (
        <Svg size={size} className={className} label={label}>
          <path d="m5.5 12.5 4 4 9-9" />
        </Svg>
      );
    case 'route':
      return (
        <Svg size={size} className={className} label={label}>
          <circle cx="6" cy="18" r="2.2" fill={filled ? 'currentColor' : 'none'} />
          <circle cx="18" cy="6" r="2.2" fill={filled ? 'currentColor' : 'none'} />
          <path d="M8.2 18h6.3a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6.3" />
        </Svg>
      );
    case 'dots':
      return (
        <Svg size={size} className={className} label={label}>
          <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </Svg>
      );
    case 'gps':
      return (
        <Svg size={size} className={className} label={label}>
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5" />
        </Svg>
      );
  }
}

export function Icon({ name, size = 22, filled = false, className, style, label }: IconProps) {
  if (name in ICONLY) {
    const C = ICONLY[name as keyof typeof ICONLY];
    return (
      <span className={className} style={{ display: 'inline-flex', lineHeight: 0, ...style }} aria-label={label} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true}>
        <C set={filled ? 'bold' : 'curved'} size={size} primaryColor="currentColor" />
      </span>
    );
  }
  return <span style={{ display: 'inline-flex', lineHeight: 0, ...style }}>{custom(name as CustomName, size, filled, className, label)}</span>;
}
