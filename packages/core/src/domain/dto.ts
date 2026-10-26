/** 서비스가 돌려주는 데이터 형태 (서버·클라이언트 공용) */
import type { EligibilityLevel, EligibilityResult } from '../stats/eligibility.ts';
import type { LatLng } from '../stats/geo.ts';
import type { RunnerLevel } from '../stats/level.ts';
import type { TrustGrade, TrustScore } from '../stats/trust.ts';
import type { MeetingPlace, PlaceRule } from './places.ts';

export type Gender = 'male' | 'female';
export type AvatarColor = 'violet' | 'sky' | 'mint' | 'peach' | 'yellow' | 'pink' | 'navy';

export interface Avatar {
  emoji: string;
  color: AvatarColor;
}

export interface Privacy {
  /** 나이 공개: 정확한 나이 / 연령대 / 비공개 */
  age: 'exact' | 'decade' | 'hidden';
  gender: 'public' | 'hidden';
  /** 기록 통계: 전체 공개 / 참여 신청할 때만 / 비공개(판정 결과만 공유) */
  stats: 'public' | 'on_apply' | 'private';
  /** 기록 목록 */
  records: 'public' | 'followers' | 'private';
}

export interface NotifyPrefs {
  newRace: boolean;
  raceOpen: boolean;
  flashMatch: boolean;
  flashActivity: boolean;
  crew: boolean;
  social: boolean;
}

export interface SelfReported {
  maxDistanceKm?: number | null;
  paceS?: number | null;
}

export interface Consents {
  terms?: string;
  privacy?: string;
  location?: string;
  health?: string;
  manners?: string;
  marketing?: string | null;
}

export const DEFAULT_PRIVACY: Privacy = { age: 'decade', gender: 'public', stats: 'on_apply', records: 'followers' };
export const DEFAULT_NOTIFY: NotifyPrefs = {
  newRace: true,
  raceOpen: true,
  flashMatch: true,
  flashActivity: true,
  crew: true,
  social: true,
};

export interface LevelBadge {
  status: 'ok' | 'insufficient';
  sustainableKm: number | null;
  typicalPaceS: number | null;
  verifiedRunCount: number;
}

export interface UserCard {
  id: string;
  nickname: string;
  avatar: Avatar;
  ageLabel: string | null;
  genderLabel: string | null;
  region: string | null;
  phoneVerified: boolean;
  trustScore: number;
  trustGrade: TrustGrade;
  /** 통계 비공개면 null */
  level: LevelBadge | null;
}

export interface Me {
  id: string;
  email: string;
  nickname: string;
  avatar: Avatar;
  bio: string;
  birthDate: string;
  age: number;
  isMinor: boolean;
  gender: Gender;
  homeRegion: string;
  runRegions: string[];
  privacy: Privacy;
  notifyPrefs: NotifyPrefs;
  selfReported: SelfReported;
  consents: Consents;
  phoneVerified: boolean;
  phoneLast4: string | null;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface UserProfile {
  user: UserCard;
  bio: string;
  runRegions: string[];
  isMe: boolean;
  following: boolean;
  followedBy: boolean;
  blocked: boolean;
  followerCount: number;
  followingCount: number;
  level: RunnerLevel | null;
  trust: TrustScore;
  canSeeRecords: boolean;
  recentRuns: RunDto[];
  mannerTags: { tag: string; count: number }[];
  crews: { id: string; name: string; emoji: string; color: AvatarColor; role: string }[];
  selfReported: SelfReported | null;
}

export type RunSource = 'gps' | 'import' | 'health' | 'manual';

export const RUN_SOURCE_LABELS: Record<RunSource, string> = {
  gps: 'GPS 측정',
  import: '파일 가져오기',
  health: '헬스 커넥트',
  manual: '직접 입력',
};

export interface RunDto {
  id: string;
  userId: string;
  startedAt: string;
  distanceM: number;
  durationS: number;
  paceS: number;
  source: RunSource;
  verified: boolean;
  sourceDetail: string | null;
  route: LatLng[] | null;
  /** full: 본인에게 전체 경로 / trimmed: 다른 사람에게 출발·도착 근처를 가림 / hidden: 짧아서 경로 전체를 숨김 */
  routePrivacy: 'full' | 'trimmed' | 'hidden';
  title: string | null;
  note: string | null;
  problems: string[];
  createdAt: string;
}

export interface PostDto {
  id: string;
  author: UserCard;
  run: RunDto | null;
  body: string;
  photos: string[];
  scope: 'region' | 'followers' | 'crew';
  region: string;
  crew: { id: string; name: string } | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  isMine: boolean;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  postId: string;
  author: UserCard;
  body: string;
  isMine: boolean;
  createdAt: string;
}

export interface FlashGroupDto {
  id: string;
  name: string;
  paceS: number;
  capacity: number;
  /** 확정 인원 (호스트 포함) */
  confirmedCount: number;
  pendingCount: number;
  isHostGroup: boolean;
  /** 호스트 기록 기준 목표 보증 판정 */
  hostEligibility: EligibilityLevel | null;
  /** 내 기록 기준 판정 (로그인 시) */
  myEligibility: EligibilityResult | null;
}

export interface FlashRestrictions {
  gender: 'any' | Gender;
  ageMin: number | null;
  ageMax: number | null;
  allowMinors: boolean;
  minTrust: number | null;
}

export interface HostStatsSnapshot {
  capturedAt: string;
  verifiedRunCount: number;
  sustainableKm: number | null;
  typicalPaceS: number | null;
  weeklyAvgKm: number;
  lastVerifiedAt: string | null;
  predictions: RunnerLevel['predictions'];
}

export type ParticipationStatus = 'confirmed' | 'pending' | 'rejected' | 'cancelled' | 'attended' | 'no_show';

export interface MyParticipation {
  status: ParticipationStatus;
  groupId: string;
  role: 'host' | 'member';
  eligibility: EligibilityLevel;
  warningConfirmed: boolean;
  completed: boolean | null;
}

export interface FlashRunListItem {
  id: string;
  title: string;
  startsAt: string;
  region: string;
  place: MeetingPlace;
  distanceKm: number;
  status: 'open' | 'cancelled' | 'completed';
  host: UserCard;
  groups: FlashGroupDto[];
  restrictions: FlashRestrictions;
  confirmedCount: number;
  capacityTotal: number;
  isFull: boolean;
  my: {
    participation: MyParticipation | null;
    /** 그룹 중 가장 여유 있는 판정 */
    bestEligibility: EligibilityLevel | null;
    bestGroupId: string | null;
    /** 성별·나이 등 참여 제한 사유 (없으면 null) */
    restriction: string | null;
    isHost: boolean;
  };
}

export interface ParticipantDto {
  user: UserCard;
  groupId: string;
  role: 'host' | 'member';
  status: ParticipationStatus;
  eligibility: EligibilityLevel;
  /** 통계 공유에 동의한 경우만 */
  eligibilityDetail: EligibilityResult | null;
  warningConfirmed: boolean;
  message: string;
  completed: boolean | null;
  createdAt: string;
  reviewedByMe: boolean;
}

export interface FlashRunDetail extends FlashRunListItem {
  description: string;
  hostStats: HostStatsSnapshot;
  hostLevelNow: LevelBadge | null;
  placeRule: PlaceRule | null;
  participants: ParticipantDto[];
  cancelReason: string | null;
  completedAt: string | null;
  permissions: {
    canJoin: boolean;
    canLeave: boolean;
    canManage: boolean;
    canComplete: boolean;
    canReview: boolean;
  };
}

export interface CrewConditions {
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: 'any' | Gender;
  /** 지속 가능 거리 최소 (km) */
  minDistanceKm?: number | null;
  /** 평소 페이스 최대 (초/km, 이보다 빨라야 함) */
  maxPaceS?: number | null;
}

export type CrewMemberStatus = 'pending' | 'active' | 'rejected' | 'left' | 'removed';
export type CrewRole = 'leader' | 'manager' | 'member';

export interface CrewListItem {
  id: string;
  name: string;
  description: string;
  region: string;
  areas: string[];
  emoji: string;
  color: AvatarColor;
  memberCount: number;
  maxMembers: number;
  conditions: CrewConditions;
  duesAmount: number | null;
  leader: UserCard;
  schedulesSummary: string[];
  my: {
    status: CrewMemberStatus | null;
    role: CrewRole | null;
    /** 가입 조건 미충족 사유 */
    conditionProblems: string[];
  };
}

export interface CrewScheduleDto {
  id: string;
  title: string;
  weekday: number;
  time: string;
  place: MeetingPlace;
  distanceKm: number;
  paceS: number | null;
  active: boolean;
}

export interface CrewEventDto {
  id: string;
  crewId: string;
  scheduleId: string | null;
  title: string;
  startsAt: string;
  place: MeetingPlace;
  distanceKm: number;
  paceS: number | null;
  cancelled: boolean;
  goingCount: number;
  myRsvp: 'going' | 'not_going' | null;
  attendedCount: number | null;
}

export interface CrewNoticeDto {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author: UserCard;
  createdAt: string;
}

export interface CrewMemberDto {
  user: UserCard;
  role: CrewRole;
  status: CrewMemberStatus;
  message: string;
  requestedAt: string;
  joinedAt: string | null;
  /** 가입 신청 시 통계 공유 동의한 경우 (운영진에게만) */
  level: LevelBadge | null;
  conditionProblems: string[];
  attendanceRate: number | null;
}

export interface CrewDetail extends CrewListItem {
  notices: CrewNoticeDto[];
  schedules: CrewScheduleDto[];
  upcomingEvents: CrewEventDto[];
  permissions: { canManage: boolean; isLeader: boolean; canApply: boolean; canLeave: boolean };
  pendingCount: number;
}

export interface DuesStatus {
  period: string;
  amount: number | null;
  members: { user: UserCard; paid: boolean; paidAt: string | null }[];
  paidCount: number;
  totalCollected: number;
}

export type CourseKey = 'full' | 'half' | '10k' | '5k' | 'other';

export interface MarathonCourse {
  key: CourseKey;
  label: string;
  distanceKm: number;
  fee?: number | null;
  capacity?: number | null;
}

export type MarathonStatus = 'upcoming' | 'open' | 'closed' | 'finished';

export interface MarathonDto {
  id: string;
  name: string;
  organizer: string;
  region: string;
  venue: string;
  eventDate: string;
  startTime: string | null;
  courses: MarathonCourse[];
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationMethod: 'first_come' | 'lottery';
  registrationUrl: string | null;
  homepage: string | null;
  description: string;
  isSample: boolean;
  status: MarathonStatus;
  inMyRegion: boolean;
  my: { alert: boolean; plan: 'interested' | 'going' | null; course: string | null };
  followerCount: number;
  mateCount: number;
}

export interface MatePostDto {
  id: string;
  marathonId: string;
  author: UserCard;
  kind: 'pace' | 'travel';
  course: string | null;
  goalTimeS: number | null;
  title: string;
  body: string;
  travel: { from?: string; transport?: string; lodging?: boolean; departAt?: string };
  capacity: number;
  acceptedCount: number;
  status: 'open' | 'closed';
  my: {
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | null;
    isAuthor: boolean;
    /** 페이스 메이트: 내 기록으로 목표 기록이 맞는지 */
    fit: EligibilityLevel | null;
  };
  members: { user: UserCard; status: string; message: string }[] | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ReportDto {
  id: string;
  reporter: UserCard;
  targetType: string;
  targetId: string;
  targetUser: UserCard | null;
  targetPreview: string;
  reason: string;
  detail: string;
  status: 'open' | 'upheld' | 'dismissed';
  resolution: string | null;
  createdAt: string;
}

export interface Metric {
  key: string;
  label: string;
  value: number | null;
  /** 0~1 비율이면 percent */
  format: 'percent' | 'count';
  numerator?: number;
  denominator?: number;
  description: string;
}

export interface AdminMetrics {
  generatedAt: string;
  core: Metric[];
  counts: Metric[];
  weekly: { weekStart: string; created: number; realized: number }[];
}
