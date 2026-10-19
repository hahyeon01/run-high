/**
 * 데모 데이터 시드. 모든 날짜는 시드하는 시점(now) 기준 상대값입니다.
 * 데모(로컬) 모드와 서버 개발 환경에서 같은 데이터를 씁니다.
 */
import type { Db } from '../db/types.ts';
import { DEFAULT_NOTIFY, type Avatar, type Gender, type Privacy } from '../domain/dto.ts';
import { getPlace, type MeetingPlace } from '../domain/places.ts';
import { assessTarget } from '../stats/eligibility.ts';
import { computeLevel, type RunSample } from '../stats/level.ts';
import type { LatLng } from '../stats/geo.ts';
import { hashPassword } from '../util/crypto.ts';
import { seededId } from '../util/ids.ts';
import { toJson } from '../util/json.ts';
import { between, mulberry32, pick } from '../util/random.ts';
import { addDays, DAY_MS, HOUR_MS, kstAt, kstDate, kstMonth, MINUTE_MS } from '../util/time.ts';
import { setMeta } from '../db/schema.ts';
import { DEMO_PASSWORD } from './accounts.ts';
import { SEED_ART } from './art.ts';
import { sha256Hex } from '../util/crypto.ts';

type UserKey =
  | 'demo' | 'pacer' | 'squirrel' | 'minji' | 'tenk' | 'dawn' | 'busan' | 'breeze'
  | 'slow' | 'sub4' | 'mom' | 'daegu' | 'teen' | 'admin' | 'noshow' | 'jeju';

interface SeedUser {
  key: UserKey;
  nickname: string;
  email: string;
  age: number;
  gender: Gender;
  home: string;
  regions: string[];
  avatar: Avatar;
  bio: string;
  base: [number, number];
  profile: { paceS: number; distKm: number; perWeek: number };
  role?: 'admin';
  privacy?: Partial<Privacy>;
  phone?: boolean;
}

const USERS: SeedUser[] = [
  { key: 'demo', nickname: '한강러너', email: 'demo@runhigh.app', age: 29, gender: 'female', home: '서울 마포구', regions: ['서울 마포구', '서울 영등포구', '서울 용산구'], avatar: { emoji: '🌊', color: 'violet' }, bio: '퇴근 후 한강에서 10K 달려요. 올해 목표는 하프 완주!', base: [37.5547, 126.8977], profile: { paceS: 350, distKm: 10, perWeek: 3 }, privacy: { records: 'public' } },
  { key: 'pacer', nickname: '페이스메이커J', email: 'pacer@runhigh.app', age: 35, gender: 'male', home: '서울 서초구', regions: ['서울 서초구', '서울 강남구', '서울 동작구'], avatar: { emoji: '⚡', color: 'navy' }, bio: '서브3 목표. 페이스 조절이 필요한 분들과 함께 달려요.', base: [37.5103, 126.9958], profile: { paceS: 290, distKm: 18, perWeek: 5 }, privacy: { stats: 'public', records: 'public' } },
  { key: 'squirrel', nickname: '달리는다람쥐', email: 'squirrel@runhigh.app', age: 27, gender: 'female', home: '서울 송파구', regions: ['서울 송파구', '서울 강동구', '서울 광진구'], avatar: { emoji: '🐿️', color: 'peach' }, bio: '주말엔 올림픽공원, 평일엔 석촌호수. 달리고 브런치 먹는 게 낙이에요.', base: [37.5206, 127.1215], profile: { paceS: 345, distKm: 10, perWeek: 4 }, privacy: { stats: 'public' } },
  { key: 'minji', nickname: '초보러너민지', email: 'minji@runhigh.app', age: 24, gender: 'female', home: '서울 마포구', regions: ['서울 마포구', '서울 서대문구'], avatar: { emoji: '🌱', color: 'mint' }, bio: '런데이로 시작해서 이제 5K 완주했어요!', base: [37.5547, 126.8977], profile: { paceS: 440, distKm: 5, perWeek: 3 } },
  { key: 'tenk', nickname: '오늘도10K', email: 'tenk@runhigh.app', age: 41, gender: 'male', home: '경기 수원시', regions: ['경기 수원시', '경기 용인시'], avatar: { emoji: '🔥', color: 'yellow' }, bio: '광교호수 지킴이. 수원 화성 10K 준비 중', base: [37.2834, 127.0656], profile: { paceS: 325, distKm: 13, perWeek: 4 }, privacy: { stats: 'public' } },
  { key: 'dawn', nickname: '새벽런', email: 'dawn@runhigh.app', age: 38, gender: 'female', home: '서울 영등포구', regions: ['서울 영등포구', '서울 마포구'], avatar: { emoji: '☀️', color: 'yellow' }, bio: '마포 새벽런 크루장. 출근 전 한 시간이 하루를 바꿔요.', base: [37.5284, 126.9326], profile: { paceS: 370, distKm: 11, perWeek: 5 }, privacy: { stats: 'public' } },
  { key: 'busan', nickname: '부산갈매기러너', email: 'busan@runhigh.app', age: 33, gender: 'male', home: '부산 수영구', regions: ['부산 수영구', '부산 해운대구'], avatar: { emoji: '🌊', color: 'sky' }, bio: '광안리 선셋런 매주 수요일', base: [35.1532, 129.1186], profile: { paceS: 320, distKm: 17, perWeek: 4 } },
  { key: 'breeze', nickname: '한강바람', email: 'breeze@runhigh.app', age: 30, gender: 'male', home: '서울 광진구', regions: ['서울 광진구', '서울 성동구', '서울 마포구'], avatar: { emoji: '🍃', color: 'mint' }, bio: '뚝섬에서 망원까지, 한강은 다 내 코스', base: [37.5296, 127.0699], profile: { paceS: 352, distKm: 10, perWeek: 3 } },
  { key: 'slow', nickname: '슬로우조거', email: 'slow@runhigh.app', age: 46, gender: 'female', home: '서울 노원구', regions: ['서울 노원구', '서울 도봉구'], avatar: { emoji: '🐢', color: 'mint' }, bio: '40대 후반에 시작한 달리기. 천천히 오래 가요.', base: [37.6249, 127.0652], profile: { paceS: 450, distKm: 7, perWeek: 3 } },
  { key: 'sub4', nickname: '서브4도전', email: 'sub4@runhigh.app', age: 36, gender: 'male', home: '서울 강남구', regions: ['서울 강남구', '서울 서초구', '서울 영등포구'], avatar: { emoji: '🎯', color: 'violet' }, bio: '풀코스 서브4 도전기. 주말 LSD 같이 해요.', base: [37.4842, 127.0461], profile: { paceS: 305, distKm: 20, perWeek: 5 }, privacy: { stats: 'public', records: 'public' } },
  { key: 'mom', nickname: '러닝맘수진', email: 'mom@runhigh.app', age: 39, gender: 'female', home: '경기 고양시', regions: ['경기 고양시', '서울 은평구', '서울 영등포구'], avatar: { emoji: '🌷', color: 'pink' }, bio: '아이 등원 후 호수공원 한 바퀴', base: [37.6583, 126.7672], profile: { paceS: 390, distKm: 8, perWeek: 3 } },
  { key: 'daegu', nickname: '대구수성러너', email: 'daegu@runhigh.app', age: 28, gender: 'male', home: '대구 수성구', regions: ['대구 수성구', '대구 중구'], avatar: { emoji: '🦁', color: 'peach' }, bio: '수성못 야간런 좋아해요', base: [35.8277, 128.6177], profile: { paceS: 335, distKm: 10, perWeek: 4 } },
  { key: 'teen', nickname: '청춘러너', email: 'teen@runhigh.app', age: 17, gender: 'male', home: '서울 노원구', regions: ['서울 노원구'], avatar: { emoji: '🐇', color: 'sky' }, bio: '육상부는 아니지만 달리기 좋아요', base: [37.6249, 127.0652], profile: { paceS: 380, distKm: 5, perWeek: 3 } },
  { key: 'admin', nickname: '런하이운영자', email: 'admin@runhigh.app', age: 34, gender: 'female', home: '서울 중구', regions: ['서울 중구', '서울 종로구', '서울 송파구'], avatar: { emoji: '🛡️', color: 'navy' }, bio: '런하이 운영팀입니다. 매너 있는 러닝 문화를 함께 만들어요.', base: [37.5547, 126.9877], profile: { paceS: 360, distKm: 9, perWeek: 3 }, role: 'admin' },
  { key: 'noshow', nickname: '노쇼왕', email: 'noshow@runhigh.app', age: 26, gender: 'male', home: '서울 마포구', regions: ['서울 마포구'], avatar: { emoji: '🌀', color: 'navy' }, bio: '', base: [37.5547, 126.8977], profile: { paceS: 350, distKm: 8, perWeek: 3 } },
  { key: 'jeju', nickname: '제주올레러너', email: 'jeju@runhigh.app', age: 42, gender: 'female', home: '제주 제주시', regions: ['제주 제주시', '제주 서귀포시'], avatar: { emoji: '🍊', color: 'peach' }, bio: '올레길 트레일러닝', base: [33.5167, 126.5237], profile: { paceS: 400, distKm: 14, perWeek: 3 } },
];

const uid = (k: UserKey) => seededId('usr', k);

interface SeedRun {
  id: string;
  user: UserKey;
  startedAt: Date;
  km: number;
  paceS: number;
  source: 'gps' | 'import' | 'health' | 'manual';
  detail: string;
  route: LatLng[] | null;
  title: string | null;
}

/** 강변 왕복 또는 루프 모양의 그럴듯한 경로 */
/**
 * 그럴듯한 러닝 경로 (지도 없이 선으로만 그리므로 모양이 자연스러워 보이게)
 *  - outback: 강변처럼 완만하게 휘는 길을 갔다가, 몇십 m 옆 길로 돌아오는 왕복
 *  - loop   : 공원·호수 둘레처럼 찌그러진 고리
 * seed 하나로 모양 전체가 정해집니다 (다른 시드 데이터의 난수 순서에 영향 없음).
 */
function makeRoute(seed: number, base: [number, number], km: number, shape: 'loop' | 'outback'): LatLng[] {
  const rng = mulberry32(Math.floor(seed * 4_294_967_296));
  const [lat0, lng0] = base;
  const mLat = 1 / 111_320;
  const mLng = 1 / (111_320 * Math.cos((lat0 * Math.PI) / 180));
  const total = km * 1000;
  const xy: [number, number][] = [];
  const rot = between(rng, 0, Math.PI * 2);
  if (shape === 'outback') {
    const half = total / 2;
    const amp = half * between(rng, 0.05, 0.11);
    const freq = between(rng, 0.8, 1.8);
    const phase = between(rng, 0, Math.PI * 2);
    const sep = Math.max(35, half * 0.04);
    const n = 56;
    const side = (d: number) => Math.sin((d / half) * Math.PI * freq + phase) * amp + Math.sin(d / 180) * 12;
    for (let i = 0; i <= n; i++) {
      const d = (half * i) / n;
      xy.push([d, side(d)]);
    }
    // 반환점에서 작은 고리를 돌아 옆 길로 복귀
    for (let k = 1; k <= 6; k++) {
      const a = (k / 6) * Math.PI;
      xy.push([half + Math.sin(a) * sep * 0.8, side(half) - sep / 2 + Math.cos(a) * (sep / 2)]);
    }
    for (let i = n; i >= 0; i--) {
      const d = (half * i) / n;
      xy.push([d, side(d) - sep * Math.min(1, i / 5)]);
    }
  } else {
    const r = total / (2 * Math.PI);
    const p1 = between(rng, 0, Math.PI * 2);
    const p2 = between(rng, 0, Math.PI * 2);
    const sx = between(rng, 1.1, 1.45);
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * Math.PI;
      const rr = r * (1 + Math.sin(2 * a + p1) * 0.16 + Math.sin(3 * a + p2) * 0.07);
      xy.push([Math.cos(a) * rr * sx - r * sx, Math.sin(a) * rr / sx]);
    }
  }
  return xy.map(([x, y]) => {
    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);
    return [Math.round((lat0 + yr * mLat) * 1e5) / 1e5, Math.round((lng0 + xr * mLng) * 1e5) / 1e5] as LatLng;
  });
}

const SOURCES: { source: SeedRun['source']; detail: string }[] = [
  { source: 'gps', detail: '런하이 GPS' },
  { source: 'import', detail: 'garmin_activity.gpx' },
  { source: 'health', detail: '헬스 커넥트 · Samsung Health' },
  { source: 'import', detail: 'strava_export.tcx' },
  { source: 'health', detail: '헬스 커넥트 · Galaxy Watch' },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 데모 계정은 판정 결과가 예측 가능하도록 직접 정한 기록을 씁니다 */
const DEMO_RUNS: [number, number, number, string][] = [
  // [며칠 전, km, 초/km, 시각]
  [1, 10.2, 352, '19:40'],
  [3, 6.0, 340, '07:10'],
  [5, 8.1, 348, '20:05'],
  [8, 12.0, 365, '07:30'],
  [10, 5.0, 335, '19:50'],
  [13, 10.0, 355, '20:10'],
  [16, 7.0, 345, '06:40'],
  [19, 10.5, 358, '19:30'],
  [22, 5.2, 330, '20:20'],
  [26, 8.0, 350, '07:00'],
];

function generateRuns(now: Date): SeedRun[] {
  const rng = mulberry32(20261015);
  const runs: SeedRun[] = [];
  let n = 0;
  const push = (u: SeedUser, startedAt: Date, km: number, paceS: number, src: { source: SeedRun['source']; detail: string }, title: string | null = null) => {
    const shape = rng() < 0.5 ? 'outback' : 'loop';
    runs.push({
      id: seededId('run', n++),
      user: u.key,
      startedAt,
      km,
      paceS: Math.round(paceS),
      source: src.source,
      detail: src.detail,
      route: src.source === 'manual' ? null : makeRoute(rng(), u.base, km, shape),
      title,
    });
  };

  for (const u of USERS) {
    if (u.key === 'demo') {
      DEMO_RUNS.forEach(([ago, km, pace, time], i) => {
        push(u, kstAt(now, -ago, time), km, pace, SOURCES[i % 3], i === 3 ? '하프 대비 장거리' : null);
      });
      push(u, kstAt(now, -2, '21:00'), 3.0, 400, { source: 'manual', detail: '직접 입력' }, '트레드밀 (직접 입력)');
      push(u, kstAt(now, -40, '08:00'), 21.1, 360, { source: 'manual', detail: '직접 입력' }, '작년 하프 기록 옮겨 적기');
      continue;
    }
    const { paceS, distKm, perWeek } = u.profile;
    // 호스트가 될 수 있도록 최근 2주 안에 최소 2회 기록 보장
    const forced = new Set([2, 6]);
    for (let d = 1; d <= 60; d++) {
      if (!forced.has(d) && rng() > perWeek / 7) continue;
      const isLong = rng() < 0.16;
      const km = round1(Math.max(2, distKm * (isLong ? between(rng, 1.12, 1.4) : between(rng, 0.55, 1.0))));
      const pace = paceS * (1 + between(rng, -0.03, 0.045) + (isLong ? 0.045 : 0));
      const hour = pick(rng, ['06:30', '07:00', '19:30', '20:00', '21:00']);
      const src = rng() < 0.08 ? { source: 'manual' as const, detail: '직접 입력' } : pick(rng, SOURCES);
      push(u, kstAt(now, -d, hour), km, pace, src);
    }
  }
  return runs.filter((r) => r.startedAt.getTime() < now.getTime() - 30 * MINUTE_MS);
}

export interface SeedResult {
  users: number;
  runs: number;
}

/** 빈 DB(마이그레이션 직후)에 데모 데이터를 넣습니다 */
export async function seedDemo(db: Db, now: Date): Promise<SeedResult> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ts = (d: Date) => d.toISOString();
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const runs = generateRuns(now);
  const samples = (k: UserKey): RunSample[] =>
    runs.filter((r) => r.user === k).map((r) => ({ startedAt: ts(r.startedAt), distanceM: r.km * 1000, durationS: r.km * r.paceS, verified: r.source !== 'manual' }));
  const assess = (k: UserKey, distanceKm: number, paceS: number) => assessTarget(samples(k), now, { distanceKm, paceS });
  const place = (id: string, detail?: string): MeetingPlace => {
    const p = getPlace(id)!;
    return { placeId: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, detail };
  };
  const custom = (name: string, detail?: string, address?: string): MeetingPlace => ({ placeId: null, name, detail, address });

  db.transaction(() => {
    /* ---------- 사용자 ---------- */
    const thisYear = Number(kstDate(now).slice(0, 4));
    USERS.forEach((u, i) => {
      const birth = `${thisYear - u.age}-01-${String(10 + i).padStart(2, '0')}`;
      const created = ago((90 + i * 3) * DAY_MS);
      const phone = u.phone !== false;
      db.run(
        `INSERT INTO users (id, email, password_hash, nickname, birth_date, gender, home_region, run_regions, avatar, bio, privacy,
           notify_prefs, self_reported, consents, phone_hash, phone_last4, phone_verified_at, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          uid(u.key),
          u.email,
          passwordHash,
          u.nickname,
          birth,
          u.gender,
          u.home,
          toJson(u.regions),
          toJson(u.avatar),
          u.bio,
          toJson({ age: 'decade', gender: 'public', stats: 'on_apply', records: 'followers', ...u.privacy }),
          toJson(DEFAULT_NOTIFY),
          toJson(u.key === 'demo' ? { maxDistanceKm: 21.1, paceS: 345 } : {}),
          toJson({ terms: created, privacy: created, location: created, health: created, manners: created, marketing: null }),
          phone ? sha256Hex(`phone:seed-${u.key}`) : null,
          phone ? String(1000 + i * 137).slice(-4) : null,
          phone ? created : null,
          u.role ?? 'user',
          created,
          created,
        ],
      );
    });

    /* ---------- 기록 ---------- */
    for (const r of runs) {
      db.run(
        `INSERT INTO runs (id, user_id, started_at, distance_m, duration_s, source, verified, source_detail, route, title, problems, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          uid(r.user),
          ts(r.startedAt),
          Math.round(r.km * 1000),
          Math.round(r.km * r.paceS),
          r.source,
          r.source !== 'manual',
          r.detail,
          r.route ? toJson(r.route) : null,
          r.title,
          toJson(r.source === 'manual' ? ['직접 입력한 기록은 참고용이라 레벨 산출과 번개 자격 판정에 쓰지 않아요'] : []),
          ts(new Date(r.startedAt.getTime() + HOUR_MS)),
        ],
      );
    }
    const latestRun = (k: UserKey, minKm = 0) =>
      runs.filter((r) => r.user === k && r.source !== 'manual' && r.km >= minKm).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];

    /* ---------- 팔로우·차단 ---------- */
    const follows: [UserKey, UserKey][] = [
      ['demo', 'pacer'], ['demo', 'squirrel'], ['demo', 'dawn'], ['demo', 'breeze'],
      ['pacer', 'demo'], ['squirrel', 'demo'], ['minji', 'demo'], ['dawn', 'demo'], ['breeze', 'demo'],
      ['minji', 'dawn'], ['sub4', 'pacer'], ['pacer', 'sub4'], ['mom', 'dawn'], ['tenk', 'pacer'], ['admin', 'demo'],
      ['breeze', 'pacer'], ['squirrel', 'pacer'], ['teen', 'slow'],
    ];
    follows.forEach(([a, b], i) => db.run('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)', [uid(a), uid(b), ago((30 - i) * DAY_MS)]));

    /* ---------- 크루 ---------- */
    type CrewKey = 'mapo' | 'banpo' | 'songpa' | 'suwon' | 'busan' | 'slow' | 'yeouido' | 'yongsan';
    const cid = (k: CrewKey) => seededId('crw', k);
    const crews: {
      key: CrewKey; name: string; region: string; leader: UserKey; conditions: object; dues: number | null; emoji: string; color: string;
      desc: string; areas: string[]; members: [UserKey, 'manager' | 'member' | 'pending', string?][];
      schedules: { title: string; weekday: number; time: string; place: MeetingPlace; km: number; pace: number | null }[];
    }[] = [
      {
        key: 'mapo', name: '마포 새벽런', region: '서울 마포구', leader: 'dawn', conditions: { ageMin: 20, ageMax: 49, gender: 'any' }, dues: 10000,
        emoji: '🌅', color: 'peach', areas: ['망원한강공원', '상암 하늘공원'],
        desc: '출근 전 망원·상암 한강에서 함께 달리는 새벽 크루예요. 초보도 6분 30초 조로 함께해요. 매너 수칙을 꼭 지켜 주세요.',
        members: [['breeze', 'manager'], ['demo', 'member'], ['minji', 'member'], ['noshow', 'pending', '새벽런 가입하고 싶어요! 이번엔 꼭 나갈게요']],
        schedules: [
          { title: '화요 새벽 7K', weekday: 2, time: '06:30', place: custom('망원한강공원', '망원나들목 앞'), km: 7, pace: 390 },
          { title: '목요 새벽 7K', weekday: 4, time: '06:30', place: custom('망원한강공원', '망원나들목 앞'), km: 7, pace: 390 },
          { title: '토요 LSD 12K', weekday: 6, time: '07:00', place: custom('망원한강공원', '망원나들목 앞'), km: 12, pace: 400 },
        ],
      },
      {
        key: 'banpo', name: '반포 서브4 클럽', region: '서울 서초구', leader: 'pacer', conditions: { minDistanceKm: 10, maxPaceS: 330, gender: 'any' }, dues: 20000,
        emoji: '⚡', color: 'navy', areas: ['반포한강공원', '반포종합운동장'],
        desc: "풀코스 서브4를 목표로 함께 훈련해요. 지속 가능 거리 10km, 평소 페이스 5'30\" 이내 조건이 있어요.",
        members: [['sub4', 'manager'], ['tenk', 'member']],
        schedules: [
          { title: '수요 트랙 인터벌', weekday: 3, time: '20:00', place: place('banpo-stadium', '본부석 앞'), km: 8, pace: 290 },
          { title: '토요 LSD 20K', weekday: 6, time: '07:00', place: place('banpo-hangang', '세빛섬 앞 광장'), km: 20, pace: 340 },
        ],
      },
      {
        key: 'songpa', name: '송파 런앤브런치', region: '서울 송파구', leader: 'squirrel', conditions: { gender: 'female', ageMin: 20, ageMax: 39 }, dues: null,
        emoji: '🥐', color: 'pink', areas: ['올림픽공원', '석촌호수'],
        desc: '여성 러너만의 주말 크루. 7~8km를 6분 30초로 편하게 달리고 브런치까지 함께해요.',
        members: [['admin', 'member']],
        schedules: [{ title: '일요 브런치런', weekday: 0, time: '08:00', place: place('olympic-park', '평화의문 앞'), km: 8, pace: 390 }],
      },
      {
        key: 'suwon', name: '수원 광교 러너스', region: '경기 수원시', leader: 'tenk', conditions: { ageMin: 30, ageMax: 59, gender: 'any' }, dues: 15000,
        emoji: '🌳', color: 'mint', areas: ['광교호수공원'],
        desc: '광교호수공원 주말 10K 크루. 30~50대 직장인이 중심이에요.',
        members: [],
        schedules: [{ title: '광교호수 10K', weekday: 6, time: '07:00', place: place('gwanggyo-lake', '원천호수 주차장 앞'), km: 10, pace: 350 }],
      },
      {
        key: 'busan', name: '광안 러닝크루', region: '부산 수영구', leader: 'busan', conditions: { gender: 'any' }, dues: 10000,
        emoji: '🌊', color: 'sky', areas: ['광안리 해변'],
        desc: '광안대교 야경 보며 달리는 수요 야간런 크루',
        members: [['daegu', 'member']],
        schedules: [{ title: '광안리 야간런', weekday: 3, time: '19:30', place: place('gwangalli', '민락수변공원 방향 입구'), km: 8, pace: 345 }],
      },
      {
        key: 'slow', name: '4050 천천히 달리기', region: '서울 노원구', leader: 'slow', conditions: { ageMin: 40, ageMax: 69, gender: 'any' }, dues: null,
        emoji: '🐢', color: 'mint', areas: ['중랑천'],
        desc: '빠르지 않아도 괜찮아요. 걷뛰로 시작해서 6km까지, 천천히 오래 달려요.',
        members: [],
        schedules: [{ title: '중랑천 걷뛰', weekday: 2, time: '19:00', place: custom('중랑천 산책로', '월계1교 아래'), km: 6, pace: 460 }],
      },
      {
        key: 'yeouido', name: '여의도 퇴근런', region: '서울 영등포구', leader: 'sub4', conditions: { ageMin: 25, ageMax: 45, gender: 'any' }, dues: 10000,
        emoji: '🌉', color: 'violet', areas: ['여의도한강공원', '여의도공원'],
        desc: '여의도 직장인 퇴근런 크루. 수요일엔 여의도공원 8K, 금요일엔 한강 10K를 달려요. 페이스 조를 나눠 한 줄로 달려요.',
        members: [['mom', 'member'], ['breeze', 'member']],
        schedules: [
          { title: '수요 퇴근런 8K', weekday: 3, time: '19:30', place: place('yeouido-park', '문화의마당 입구'), km: 8, pace: 345 },
          { title: '금요 한강 10K', weekday: 5, time: '20:00', place: place('yeouido-hangang', '물빛광장 앞'), km: 10, pace: 360 },
        ],
      },
      {
        key: 'yongsan', name: '용산 하프 준비반', region: '서울 용산구', leader: 'pacer', conditions: { minDistanceKm: 12, maxPaceS: 320, gender: 'any' }, dues: 20000,
        emoji: '🎯', color: 'sky', areas: ['이촌한강공원'],
        desc: "하프 1시간 50분 이내를 목표로 하는 훈련반이에요. 지속 가능 거리 12km, 평소 페이스 5'20\" 이내 조건이 있어요.",
        members: [['sub4', 'member']],
        schedules: [{ title: '일요 이촌 LSD 16K', weekday: 0, time: '07:00', place: custom('이촌한강공원', '거북선나루 앞'), km: 16, pace: 330 }],
      },
    ];
    crews.forEach((c, i) => {
      const created = ago((80 - i * 5) * DAY_MS);
      db.run(
        `INSERT INTO crews (id, name, description, region, areas, leader_id, conditions, max_members, dues_amount, color, emoji, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 50, ?, ?, ?, ?, ?)`,
        [cid(c.key), c.name, c.desc, c.region, toJson(c.areas), uid(c.leader), toJson(c.conditions), c.dues, c.color, c.emoji, created, created],
      );
      db.run(`INSERT INTO crew_members (crew_id, user_id, role, status, requested_at, joined_at, decided_at) VALUES (?, ?, 'leader', 'active', ?, ?, ?)`, [
        cid(c.key), uid(c.leader), created, created, created,
      ]);
      c.members.forEach(([m, role, msg], j) => {
        const req = ago((60 - j * 7) * DAY_MS);
        if (role === 'pending') {
          db.run(`INSERT INTO crew_members (crew_id, user_id, role, status, message, requested_at) VALUES (?, ?, 'member', 'pending', ?, ?)`, [
            cid(c.key), uid(m), msg ?? '', ago(5 * HOUR_MS),
          ]);
        } else {
          db.run(`INSERT INTO crew_members (crew_id, user_id, role, status, requested_at, joined_at, decided_at) VALUES (?, ?, ?, 'active', ?, ?, ?)`, [
            cid(c.key), uid(m), role, req, req, req,
          ]);
        }
      });
      c.schedules.forEach((s, j) => {
        db.run(
          `INSERT INTO crew_schedules (id, crew_id, title, weekday, time, place, distance_km, pace_s, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [seededId('csc', `${c.key}${j}`), cid(c.key), s.title, s.weekday, s.time, toJson(s.place), s.km, s.pace, created],
        );
      });
    });

    // 마포 새벽런: 지난 4주 일정과 출석, 회비, 공지
    const mapoAttend: Record<string, number> = { dawn: 1, breeze: 0.9, demo: 0.75, minji: 0.4 };
    const rng = mulberry32(7);
    for (let d = 1; d <= 28; d++) {
      const day = addDays(now, -d);
      const wd = new Date(day.getTime() + 9 * HOUR_MS).getUTCDay();
      if (wd !== 2 && wd !== 4) continue;
      const evId = seededId('cev', `mapo-past-${d}`);
      const startsAt = kstAt(now, -d, '06:30');
      db.run(
        `INSERT INTO crew_events (id, crew_id, schedule_id, title, starts_at, place, distance_km, pace_s, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 7, 390, 'schedule', ?)`,
        [evId, cid('mapo'), seededId('csc', wd === 2 ? 'mapo0' : 'mapo1'), wd === 2 ? '화요 새벽 7K' : '목요 새벽 7K', ts(startsAt), toJson(custom('망원한강공원', '망원나들목 앞')), ts(addDays(startsAt, -7))],
      );
      for (const [k, p] of Object.entries(mapoAttend)) {
        const went = rng() < p;
        db.run(`INSERT INTO crew_event_attendance (event_id, user_id, rsvp, attended, updated_at) VALUES (?, ?, ?, ?, ?)`, [
          evId, uid(k as UserKey), went ? 'going' : null, went, ts(startsAt),
        ]);
      }
    }
    const thisMonth = kstMonth(now);
    const lastMonth = kstMonth(addDays(now, -31));
    for (const k of ['dawn', 'breeze', 'demo', 'minji'] as UserKey[]) {
      db.run('INSERT INTO crew_dues (crew_id, user_id, period, amount, paid_at, marked_by) VALUES (?, ?, ?, 10000, ?, ?)', [cid('mapo'), uid(k), lastMonth, ago(35 * DAY_MS), uid('dawn')]);
      if (k !== 'minji') db.run('INSERT INTO crew_dues (crew_id, user_id, period, amount, paid_at, marked_by) VALUES (?, ?, ?, 10000, ?, ?)', [cid('mapo'), uid(k), thisMonth, ago(6 * DAY_MS), uid('dawn')]);
    }
    const notices: [CrewKey, UserKey, string, string, boolean, number][] = [
      ['mapo', 'dawn', '새벽 러닝 안전·매너 수칙', '1. 산책로에서는 한 줄로 달려요\n2. "비켜요" 대신 속도를 줄여요\n3. 출발 전 단체 사진은 나들목 광장에서만\n4. 어두운 시간에는 밝은 옷이나 라이트를 착용해요', true, 40],
      ['mapo', 'dawn', `${thisMonth.slice(5)}월 회비 안내`, '이번 달 회비 1만 원은 크루 운영비(물·간식·보험)에 써요. 운영진에게 납부해 주세요.', false, 6],
      ['mapo', 'breeze', '한강 가을 하프레이스 단체 신청', '대회 탭의 "한강 가을 하프레이스"에서 참가 예정을 눌러 주세요. 페이스 메이트도 함께 구해요!', false, 0.2],
      ['banpo', 'pacer', '수요 인터벌은 4명씩 조를 나눠요', '반포종합운동장 이용 규칙(5인 이상 단체 달리기 제한)에 따라 4명씩 조를 나누고 2m 간격을 유지합니다.', true, 20],
      ['songpa', 'squirrel', '일요 브런치런 장소 안내', '평화의문 앞에서 모여요. 러닝 후 브런치는 자율 참여예요.', true, 15],
    ];
    notices.forEach(([c, a, title, body, pinned, days], i) =>
      db.run('INSERT INTO crew_notices (id, crew_id, author_id, title, body, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        seededId('cnt', i), cid(c), uid(a), title, body, pinned, ago(days * DAY_MS),
      ]),
    );

    /* ---------- 대회 ---------- */
    type RaceKey = 'hangang' | 'winter' | 'spring' | 'chuncheon' | 'busan' | 'daegu' | 'suwon' | 'jeju' | 'daejeon' | 'incheon' | 'gwangju' | 'goyang';
    const rid = (k: RaceKey) => seededId('mrt', k);
    const d = (n: number) => kstDate(addDays(now, n));
    const at = (n: number, t: string) => ts(kstAt(now, n, t));
    /** 지금부터 h시간 뒤 (10분 단위 정각) — 시드를 언제 만들어도 '내일 접수 오픈' 알림이 바로 보이도록 */
    const inHours = (h: number) => ts(new Date(Math.ceil((now.getTime() + h * HOUR_MS) / 600_000) * 600_000));
    const C = {
      full: { key: 'full', label: '풀코스', distanceKm: 42.195 },
      half: { key: 'half', label: '하프', distanceKm: 21.0975 },
      k10: { key: '10k', label: '10km', distanceKm: 10 },
      k5: { key: '5k', label: '5km', distanceKm: 5 },
    };
    const races: { key: RaceKey; name: string; region: string; venue: string; date: string; start: string; courses: object[]; opens: string | null; closes: string | null; method: 'first_come' | 'lottery'; desc: string }[] = [
      { key: 'hangang', name: '한강 가을 하프레이스', region: '서울 영등포구', venue: '여의도한강공원 이벤트광장', date: d(24), start: '08:00', courses: [{ ...C.half, fee: 50000, capacity: 5000 }, { ...C.k10, fee: 40000, capacity: 5000 }, { ...C.k5, fee: 30000, capacity: 2000 }], opens: at(-25, '10:00'), closes: at(10, '18:00'), method: 'first_come', desc: '여의도에서 출발해 반포대교를 돌아오는 강변 평지 코스예요.' },
      { key: 'winter', name: '서울 윈터 10K', region: '서울 송파구', venue: '올림픽공원 평화의광장', date: d(59), start: '09:00', courses: [{ ...C.k10, fee: 45000, capacity: 8000 }, { ...C.k5, fee: 30000, capacity: 3000 }], opens: inHours(20), closes: at(36, '18:00'), method: 'first_come', desc: '한 해를 마무리하는 겨울 10K. 선착순 접수로 매년 빠르게 마감돼요.' },
      { key: 'spring', name: '서울 스프링 마라톤', region: '서울 종로구', venue: '광화문광장', date: d(157), start: '08:00', courses: [{ ...C.full, fee: 70000, capacity: 20000 }, { ...C.k10, fee: 40000, capacity: 10000 }], opens: at(19, '10:00'), closes: at(33, '18:00'), method: 'lottery', desc: '도심을 가로지르는 봄 풀코스. 추첨 접수예요.' },
      { key: 'chuncheon', name: '춘천 호반 하프', region: '강원 춘천시', venue: '공지천 조각공원', date: d(10), start: '09:00', courses: [{ ...C.half, fee: 45000 }, { ...C.k10, fee: 35000 }], opens: at(-60, '10:00'), closes: at(-20, '18:00'), method: 'first_come', desc: '의암호를 따라 달리는 가을 하프.' },
      { key: 'busan', name: '부산 바다 마라톤', region: '부산 수영구', venue: '광안리해수욕장', date: d(31), start: '08:00', courses: [{ ...C.full, fee: 60000 }, { ...C.half, fee: 50000 }, { ...C.k10, fee: 40000 }], opens: at(-14, '10:00'), closes: at(7, '18:00'), method: 'first_come', desc: '광안대교와 해운대를 잇는 바다 코스.' },
      { key: 'daegu', name: '대구 수성못 나이트런', region: '대구 수성구', venue: '수성못 상화동산', date: d(17), start: '19:00', courses: [{ ...C.k10, fee: 40000 }, { ...C.k5, fee: 30000 }], opens: at(-30, '10:00'), closes: at(2, '23:59'), method: 'first_come', desc: '수성못을 도는 야간 레이스.' },
      { key: 'suwon', name: '수원 화성 10K', region: '경기 수원시', venue: '수원종합운동장', date: d(38), start: '09:00', courses: [{ ...C.k10, fee: 40000 }, { ...C.k5, fee: 30000 }], opens: at(3, '14:00'), closes: at(20, '18:00'), method: 'first_come', desc: '화성 성곽길을 따라 달리는 10K.' },
      { key: 'jeju', name: '제주 올레 트레일런', region: '제주 서귀포시', venue: '서귀포 올레시장 일대', date: d(52), start: '08:30', courses: [{ key: 'other', label: '25km 트레일', distanceKm: 25, fee: 70000 }, { ...C.k10, fee: 45000 }], opens: at(-5, '10:00'), closes: at(25, '18:00'), method: 'first_come', desc: '올레 6~7코스를 잇는 트레일 레이스.' },
      { key: 'daejeon', name: '대전 갑천 하프마라톤', region: '대전 유성구', venue: '엑스포시민광장', date: d(178), start: '09:00', courses: [{ ...C.half }, { ...C.k10 }, { ...C.k5 }], opens: at(87, '10:00'), closes: at(120, '18:00'), method: 'first_come', desc: '갑천 강변 평지 코스.' },
      { key: 'incheon', name: '인천 송도 레이스', region: '인천 연수구', venue: '송도 센트럴파크', date: d(3), start: '09:00', courses: [{ ...C.k10 }, { ...C.k5 }], opens: at(-70, '10:00'), closes: at(-14, '18:00'), method: 'first_come', desc: '송도 국제도시를 도는 도심 레이스.' },
      { key: 'gwangju', name: '광주 풍암호수 5K 펀런', region: '광주 서구', venue: '풍암호수공원', date: d(45), start: '10:00', courses: [{ ...C.k5, fee: 25000 }], opens: at(6, '12:00'), closes: at(30, '18:00'), method: 'first_come', desc: '가족과 함께하는 5K 펀런.' },
      { key: 'goyang', name: '고양 호수 하프', region: '경기 고양시', venue: '일산호수공원', date: d(-25), start: '08:00', courses: [{ ...C.half }, { ...C.k10 }], opens: at(-90, '10:00'), closes: at(-40, '18:00'), method: 'first_come', desc: '호수공원을 도는 하프 코스.' },
    ];
    races.forEach((r, i) => {
      const created = ago((40 - i) * DAY_MS);
      db.run(
        `INSERT INTO marathons (id, name, organizer, region, venue, event_date, start_time, courses, registration_opens_at, registration_closes_at,
           registration_method, description, is_sample, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [rid(r.key), r.name, '예시 조직위원회', r.region, r.venue, r.date, r.start, toJson(r.courses), r.opens, r.closes, r.method, `${r.desc}\n\n※ 앱 시연용 예시 데이터예요. 실제 대회 정보는 공식 홈페이지에서 확인하세요.`, created, created],
      );
    });
    const raceFollows: [RaceKey, UserKey, boolean, 'interested' | 'going' | null, string | null][] = [
      ['hangang', 'demo', false, 'going', 'half'],
      ['winter', 'demo', true, 'interested', '10k'],
      ['suwon', 'demo', true, null, null],
      ['spring', 'demo', true, 'interested', 'full'],
      ['hangang', 'squirrel', false, 'going', 'half'],
      ['hangang', 'breeze', true, 'going', '10k'],
      ['hangang', 'minji', false, 'interested', '5k'],
      ['busan', 'sub4', false, 'going', 'full'],
      ['busan', 'pacer', false, 'going', 'full'],
      ['winter', 'squirrel', true, 'interested', '10k'],
      ['suwon', 'tenk', true, 'going', '10k'],
      ['daegu', 'daegu', false, 'going', '10k'],
      ['jeju', 'jeju', false, 'going', 'other'],
    ];
    raceFollows.forEach(([r, u, alert, plan, course], i) =>
      db.run('INSERT INTO marathon_follows (marathon_id, user_id, alert, plan, course, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        rid(r), uid(u), alert, plan, course, ago((20 - i) * DAY_MS), ago((20 - i) * DAY_MS),
      ]),
    );
    const mates: { id: string; race: RaceKey; user: UserKey; kind: 'pace' | 'travel'; course: string | null; goal: number | null; title: string; body: string; travel: object; cap: number; members: [UserKey, string, string][] }[] = [
      { id: 'm1', race: 'hangang', user: 'squirrel', kind: 'pace', course: 'half', goal: 7200, title: '하프 2시간 목표 페이스 메이트 구해요', body: "5'40\" 안팎으로 일정하게 가실 분! 15km 이후 서로 끌어줘요.", travel: {}, cap: 3, members: [['breeze', 'pending', '10K 위주였는데 하프 도전해요']] },
      { id: 'm2', race: 'hangang', user: 'sub4', kind: 'pace', course: 'half', goal: 6300, title: '하프 1시간 45분 함께 달릴 분', body: "4'59\" 페이스. 초반 오버페이스 금지!", travel: {}, cap: 2, members: [] },
      { id: 'm3', race: 'busan', user: 'sub4', kind: 'travel', course: 'full', goal: null, title: '서울→부산 KTX 동행 & 숙소 쉐어', body: '대회 전날 오후 KTX로 내려가요. 광안리 근처 숙소 2인실 쉐어 원하시는 분.', travel: { from: '서울역', transport: 'KTX', lodging: true, departAt: '대회 전날 오후' }, cap: 3, members: [['pacer', 'accepted', '저도 풀 뛰어요!']] },
      { id: 'm4', race: 'winter', user: 'demo', kind: 'pace', course: '10k', goal: 3480, title: '10K 58분 목표 같이 달려요', body: "5'48\" 페이스로 끝까지! 접수 성공하면 같이 연습런도 해요.", travel: {}, cap: 3, members: [['minji', 'pending', '저도 같이 연습하고 싶어요!']] },
    ];
    mates.forEach((m, i) => {
      db.run(
        `INSERT INTO mate_posts (id, marathon_id, user_id, kind, course, goal_time_s, title, body, travel, capacity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [seededId('mtp', m.id), rid(m.race), uid(m.user), m.kind, m.course, m.goal, m.title, m.body, toJson(m.travel), m.cap, ago((5 - i) * DAY_MS)],
      );
      m.members.forEach(([u, status, msg]) =>
        db.run('INSERT INTO mate_members (post_id, user_id, status, message, created_at, decided_at) VALUES (?, ?, ?, ?, ?, ?)', [
          seededId('mtp', m.id), uid(u), status, msg, ago(DAY_MS), status === 'pending' ? null : ago(12 * HOUR_MS),
        ]),
      );
    });

    /* ---------- 번개 ---------- */
    type Part = { user: UserKey; group: number; status: 'confirmed' | 'pending' | 'attended' | 'no_show'; completed?: 0 | 1 | null; warn?: boolean; msg?: string };
    interface FlashSeed {
      key: string; host: UserKey; title: string; desc: string; startsAt: Date; place: MeetingPlace; region: string; km: number;
      groups: [number, number][]; gender?: 'any' | 'male' | 'female'; ageMin?: number | null; ageMax?: number | null; allowMinors?: boolean;
      status?: 'open' | 'completed' | 'cancelled'; cancelReason?: string; parts: Part[];
    }
    const flashes: FlashSeed[] = [
      { key: 'f1', host: 'pacer', title: '퇴근 후 반포 10K 페이스런', desc: "6분 조와 5분 20초 조로 나눠 달려요. 반포대교 남단 왕복 코스입니다. 물은 각자 챙겨 주세요!", startsAt: kstAt(now, 1, '19:30'), place: place('banpo-hangang', '세빛섬 앞 광장'), region: '서울 서초구', km: 10, groups: [[360, 6], [320, 6]], parts: [{ user: 'breeze', group: 0, status: 'confirmed' }, { user: 'sub4', group: 1, status: 'confirmed' }] },
      { key: 'f2', host: 'sub4', title: '주말 아침 여의도 하프 LSD', desc: '하프 대회 대비 장거리. 중간 급수 1회, 끝나고 스트레칭까지 같이 해요.', startsAt: kstAt(now, 3, '07:00'), place: place('yeouido-hangang', '여의나루역 2번 출구 앞'), region: '서울 영등포구', km: 21.1, groups: [[340, 6]], parts: [{ user: 'pacer', group: 0, status: 'confirmed' }] },
      { key: 'f3', host: 'dawn', title: '초보 환영! 망원 5K 슬로우런', desc: '처음 함께 달려보는 분 환영해요. 7분 30초로 천천히, 대화하면서 달려요.', startsAt: kstAt(now, 2, '20:00'), place: custom('망원한강공원', '망원나들목 앞', '서울 마포구 망원동'), region: '서울 마포구', km: 5, groups: [[450, 6]], parts: [{ user: 'minji', group: 0, status: 'confirmed' }] },
      { key: 'f4', host: 'squirrel', title: '올림픽공원 여성 러너 7K', desc: '여성 러너만 함께하는 일요일 아침 7K. 끝나고 커피 한 잔 하실 분도 환영!', startsAt: kstAt(now, 4, '08:00'), place: place('olympic-park', '평화의문 앞'), region: '서울 송파구', km: 7, groups: [[390, 6]], gender: 'female', ageMin: 20, ageMax: 39, parts: [{ user: 'admin', group: 0, status: 'confirmed' }] },
      { key: 'f5', host: 'pacer', title: '반포종합운동장 트랙 인터벌', desc: '1km × 6회 인터벌. 운동장 규칙에 따라 4명씩 조를 나눠요.', startsAt: kstAt(now, 5, '20:00'), place: place('banpo-stadium', '본부석 앞'), region: '서울 서초구', km: 6, groups: [[300, 4], [330, 4]], parts: [{ user: 'sub4', group: 0, status: 'confirmed' }] },
      { key: 'f6', host: 'tenk', title: '광교호수 일요 10K', desc: '원천호수 한 바퀴 + 신대호수 반 바퀴. 5분 50초 일정하게!', startsAt: kstAt(now, 6, '07:30'), place: place('gwanggyo-lake', '원천호수 주차장 앞'), region: '경기 수원시', km: 10, groups: [[350, 6]], parts: [] },
      { key: 'f7', host: 'busan', title: '광안리 선셋런', desc: '해 질 무렵 광안리 왕복 8K', startsAt: kstAt(now, 2, '18:30'), place: place('gwangalli', '민락수변공원 방향 입구'), region: '부산 수영구', km: 8, groups: [[345, 6]], parts: [] },
      { key: 'f8', host: 'slow', title: '중랑천 4050 천천히', desc: '40~60대 러너끼리 편하게 걷뛰해요.', startsAt: kstAt(now, 3, '06:30'), place: custom('중랑천 산책로', '월계1교 아래', '서울 노원구 월계동'), region: '서울 노원구', km: 6, groups: [[460, 6]], ageMin: 40, ageMax: 69, parts: [] },
      { key: 'f9', host: 'demo', title: '마포 야간 6K 수다런', desc: '퇴근 후 6분 30초로 수다 떨며 달려요. 한 줄 달리기 꼭 지켜요!', startsAt: kstAt(now, 1, '21:00'), place: custom('망원한강공원', '망원나들목 앞 편의점', '서울 마포구 망원동'), region: '서울 마포구', km: 6, groups: [[390, 5]], parts: [{ user: 'breeze', group: 0, status: 'confirmed' }, { user: 'minji', group: 0, status: 'pending', warn: true, msg: '조금 느리지만 끝까지 따라가 볼게요!' }] },
      { key: 'f10', host: 'admin', title: '여의도공원 점심 5K', desc: '점심시간 가볍게 5K. 공원 안내문에 따라 무리 지어 달리지 않고 2명씩 나눠 출발해요.', startsAt: kstAt(now, 2, '12:10'), place: place('yeouido-park', '문화의 마당 앞'), region: '서울 영등포구', km: 5, groups: [[380, 4]], parts: [] },
      { key: 'f11', host: 'daegu', title: '수성못 야간 8K', desc: '수성못 두 바퀴 반', startsAt: kstAt(now, 2, '20:30'), place: place('suseong-lake', '상화동산 입구'), region: '대구 수성구', km: 8, groups: [[340, 6]], parts: [] },
      { key: 'f12', host: 'slow', title: '청소년도 함께! 노원 5K', desc: '학생 러너도 함께하는 공개 번개. 보호자 동행 환영, 밝은 시간에 달려요.', startsAt: kstAt(now, 5, '17:00'), place: custom('중랑천 산책로', '월계1교 아래', '서울 노원구 월계동'), region: '서울 노원구', km: 5, groups: [[460, 6]], allowMinors: true, parts: [] },
      // 지난 번개
      { key: 'p1', host: 'pacer', title: '지난주 반포 10K', desc: '', startsAt: kstAt(now, -7, '19:30'), place: place('banpo-hangang', '세빛섬 앞 광장'), region: '서울 서초구', km: 10, groups: [[360, 6], [320, 6]], status: 'completed', parts: [{ user: 'demo', group: 0, status: 'attended', completed: 1 }, { user: 'squirrel', group: 0, status: 'attended', completed: 1 }, { user: 'noshow', group: 0, status: 'no_show' }, { user: 'breeze', group: 1, status: 'attended', completed: 1, warn: true }] },
      { key: 'p2', host: 'dawn', title: '망원 새벽 5K', desc: '', startsAt: kstAt(now, -14, '06:30'), place: custom('망원한강공원', '망원나들목 앞'), region: '서울 마포구', km: 5, groups: [[420, 6]], status: 'completed', parts: [{ user: 'demo', group: 0, status: 'attended', completed: 1 }, { user: 'minji', group: 0, status: 'attended', completed: 0, warn: true }, { user: 'noshow', group: 0, status: 'no_show' }] },
      { key: 'p3', host: 'breeze', title: '여의도 야간 8K', desc: '', startsAt: kstAt(now, -21, '20:00'), place: place('yeouido-hangang'), region: '서울 영등포구', km: 8, groups: [[360, 6]], status: 'completed', parts: [{ user: 'sub4', group: 0, status: 'attended', completed: 1 }, { user: 'mom', group: 0, status: 'attended', completed: 1, warn: true }] },
      { key: 'p4', host: 'sub4', title: '비 오는 날 양재천', desc: '', startsAt: kstAt(now, -3, '07:00'), place: place('yangjaecheon'), region: '서울 강남구', km: 10, groups: [[330, 6]], status: 'completed', parts: [] },
      { key: 'p5', host: 'noshow', title: '망원 저녁 5K 같이 뛰어요', desc: '', startsAt: kstAt(now, -10, '20:00'), place: custom('망원한강공원'), region: '서울 마포구', km: 5, groups: [[360, 6]], status: 'cancelled', cancelReason: '개인 사정', parts: [] },
      { key: 'p6', host: 'squirrel', title: '올림픽공원 모닝런', desc: '', startsAt: kstAt(now, -35, '07:00'), place: place('olympic-park', '평화의문 앞'), region: '서울 송파구', km: 7, groups: [[390, 6]], status: 'completed', parts: [{ user: 'demo', group: 0, status: 'attended', completed: 1 }, { user: 'admin', group: 0, status: 'attended', completed: 1 }] },
      { key: 'p7', host: 'pacer', title: '서초 퇴근런', desc: '', startsAt: kstAt(now, -42, '19:30'), place: place('banpo-hangang'), region: '서울 서초구', km: 8, groups: [[360, 6]], status: 'completed', parts: [{ user: 'breeze', group: 0, status: 'attended', completed: 1 }, { user: 'noshow', group: 0, status: 'no_show' }] },
      { key: 'p8', host: 'demo', title: '마포 저녁 6K', desc: '', startsAt: kstAt(now, -28, '20:00'), place: custom('망원한강공원', '망원나들목 앞'), region: '서울 마포구', km: 6, groups: [[390, 6]], status: 'completed', parts: [{ user: 'minji', group: 0, status: 'attended', completed: 1, warn: true }, { user: 'breeze', group: 0, status: 'attended', completed: 1 }] },
    ];

    const levelSnapshot = (k: UserKey) => {
      const lv = computeLevel(samples(k), now);
      return {
        capturedAt: ts(now),
        verifiedRunCount: lv.verifiedRunCount,
        sustainableKm: lv.sustainableDistanceKm,
        typicalPaceS: lv.typicalPaceS == null ? null : Math.round(lv.typicalPaceS),
        weeklyAvgKm: lv.weeklyAvgKm,
        lastVerifiedAt: lv.lastVerifiedAt,
        predictions: lv.predictions,
      };
    };

    flashes.forEach((f, i) => {
      const id = seededId('flr', f.key);
      const status = f.status ?? 'open';
      const created = ts(new Date(f.startsAt.getTime() - (2 + (i % 3)) * DAY_MS));
      const completedAt = status === 'completed' ? ts(new Date(f.startsAt.getTime() + 2 * HOUR_MS)) : null;
      db.run(
        `INSERT INTO flash_runs (id, host_id, title, description, starts_at, region, place, distance_km, gender_rule, age_min, age_max, allow_minors,
           host_stats, status, cancel_reason, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, uid(f.host), f.title, f.desc, ts(f.startsAt), f.region, toJson(f.place), f.km, f.gender ?? 'any', f.ageMin ?? null, f.ageMax ?? null,
          f.allowMinors ?? false, toJson(levelSnapshot(f.host)), status, f.cancelReason ?? null, created, created, completedAt],
      );
      const gids = f.groups.map(([pace, cap], j) => {
        const gid = seededId('frg', `${f.key}${j}`);
        db.run('INSERT INTO flash_run_groups (id, flash_run_id, name, pace_s, capacity, sort) VALUES (?, ?, ?, ?, ?, ?)', [gid, id, `${String.fromCharCode(65 + j)}조`, pace, cap, j]);
        return gid;
      });
      const hostEl = assess(f.host, f.km, f.groups[0][0]);
      db.run(
        `INSERT INTO flash_run_participants (flash_run_id, user_id, group_id, role, status, completed, eligibility, eligibility_detail, share_stats, created_at, decided_at)
         VALUES (?, ?, ?, 'host', ?, ?, ?, ?, 1, ?, ?)`,
        [id, uid(f.host), gids[0], status === 'completed' ? 'attended' : 'confirmed', status === 'completed' ? 1 : null, hostEl.level, toJson(hostEl), created, created],
      );
      f.parts.forEach((p, j) => {
        const el = assess(p.user, f.km, f.groups[p.group][0]);
        const joined = ts(new Date(Date.parse(created) + (j + 1) * 3 * HOUR_MS));
        db.run(
          `INSERT INTO flash_run_participants (flash_run_id, user_id, group_id, role, status, completed, eligibility, eligibility_detail, warning_confirmed,
             share_stats, message, created_at, decided_at)
           VALUES (?, ?, ?, 'member', ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [id, uid(p.user), gids[p.group], p.status, p.completed ?? null, el.level, toJson(el), p.warn ?? false, p.msg ?? '', joined, p.status === 'pending' ? null : joined],
        );
      });
    });

    const reviews: [string, UserKey, UserKey, string[], string[]][] = [
      ['p1', 'demo', 'pacer', ['페이스를 잘 맞춰줘요', '시간 약속을 잘 지켜요'], []],
      ['p1', 'squirrel', 'pacer', ['안전 수칙을 잘 지켜요'], []],
      ['p1', 'pacer', 'demo', ['시간 약속을 잘 지켜요', '러닝 매너가 좋아요'], []],
      ['p1', 'breeze', 'demo', ['분위기를 즐겁게 만들어요'], []],
      ['p1', 'pacer', 'squirrel', ['러닝 매너가 좋아요'], []],
      ['p2', 'dawn', 'demo', ['러닝 매너가 좋아요'], []],
      ['p2', 'dawn', 'minji', ['분위기를 즐겁게 만들어요'], []],
      ['p2', 'demo', 'dawn', ['초보도 잘 챙겨줘요', '페이스를 잘 맞춰줘요'], []],
      ['p6', 'squirrel', 'demo', ['시간 약속을 잘 지켜요'], []],
      ['p7', 'breeze', 'pacer', ['페이스를 잘 맞춰줘요'], []],
      ['p8', 'minji', 'demo', ['초보도 잘 챙겨줘요'], []],
      ['p8', 'breeze', 'demo', ['러닝 매너가 좋아요'], []],
      ['p3', 'sub4', 'breeze', ['페이스를 잘 맞춰줘요'], []],
      ['p3', 'mom', 'breeze', ['초보도 잘 챙겨줘요'], ['약속 시간에 늦었어요']],
    ];
    reviews.forEach(([f, from, to, pos, neg], i) =>
      db.run('INSERT INTO manner_reviews (id, flash_run_id, reviewer_id, reviewee_id, positive, negative, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        seededId('rev', i), seededId('flr', f), uid(from), uid(to), toJson(pos), toJson(neg), ago((6 + i) * DAY_MS),
      ]),
    );

    /* ---------- 피드 ---------- */
    const posts: { key: string; user: UserKey; body: string; run?: SeedRun; photos?: string[]; scope?: 'region' | 'followers' | 'crew'; crew?: CrewKey; hoursAgo: number }[] = [
      { key: 'demo1', user: 'demo', body: '퇴근하고 망원→여의도 왕복 10K 🌙 바람이 딱 좋았어요', run: latestRun('demo', 10), photos: [SEED_ART.night], hoursAgo: 20 },
      { key: 'pacer1', user: 'pacer', body: '반포 트랙 인터벌 8×800m. 내일 번개에서 6분 조 페이서 합니다! 처음 오시는 분도 환영해요.', run: latestRun('pacer'), photos: [SEED_ART.track], hoursAgo: 26 },
      { key: 'squirrel1', user: 'squirrel', body: '올림픽공원 단풍이 시작됐어요 🍁 일요 브런치런 멤버 모집 중이에요', photos: [SEED_ART.park], hoursAgo: 30 },
      { key: 'minji1', user: 'minji', body: '생애 첫 5K 완주!! 쉬지 않고 달렸어요 😭 새벽런 크루분들 덕분이에요', run: latestRun('minji'), hoursAgo: 34 },
      { key: 'dawn1', user: 'dawn', body: '오늘 새벽 7K 출석 9명! 다음 주 화요일에도 망원나들목에서 만나요 ☀️', photos: [SEED_ART.sunrise], scope: 'crew', crew: 'mapo', hoursAgo: 40 },
      { key: 'breeze1', user: 'breeze', body: "뚝섬 야간 10K, 5'50\" 유지 성공. 다음 목표는 한강 가을 하프 10K 부문!", run: latestRun('breeze'), hoursAgo: 46 },
      { key: 'sub4_1', user: 'sub4', body: '부산 바다 마라톤 KTX 동행 구해요. 대회 탭 메이트 글 참고해 주세요 🚄', hoursAgo: 52 },
      { key: 'busan1', user: 'busan', body: '광안대교 보면서 선셋런 🌇 수요일마다 크루런 해요', photos: [SEED_ART.sunrise], run: latestRun('busan'), hoursAgo: 55 },
      { key: 'tenk1', user: 'tenk', body: '광교호수 15K. 수원 화성 10K 접수 사흘 뒤 시작이래요. 알림 켜두세요!', run: latestRun('tenk'), hoursAgo: 60 },
      { key: 'slow1', user: 'slow', body: '40대 후반에 시작한 달리기, 이제 6km를 쉬지 않고 가요. 천천히 오래!', run: latestRun('slow'), hoursAgo: 70 },
      { key: 'mom1', user: 'mom', body: '아이 등원시키고 일산호수공원 8K ☀️', photos: [SEED_ART.park], run: latestRun('mom'), hoursAgo: 75 },
      { key: 'admin1', user: 'admin', body: "[런하이 매너 캠페인] 한 줄로, 우측으로, '비켜요' 대신 속도 줄이기 🙏 함께 달리는 문화가 오래가려면 길을 나눠 써야 해요.", hoursAgo: 80 },
      { key: 'demo2', user: 'demo', body: '하프 준비 4주차. 장거리 12K 성공! 다음 주엔 14K 도전', run: runs.find((r) => r.user === 'demo' && r.km === 12), scope: 'followers', hoursAgo: 190 },
      { key: 'daegu1', user: 'daegu', body: '수성못 나이트런 접수 마감 임박이래요!', run: latestRun('daegu'), hoursAgo: 90 },
      { key: 'jeju1', user: 'jeju', body: '올레 7코스 트레일 연습. 바람이 엄청나요 🌬️', photos: [SEED_ART.park], hoursAgo: 100 },
      { key: 'pacer2', user: 'pacer', body: '이번 주 수요 인터벌은 4명씩 조를 나눠 진행해요 (반포종합운동장 규칙)', scope: 'crew', crew: 'banpo', hoursAgo: 24 },
      { key: 'breeze2', user: 'breeze', body: "토요 LSD 후기: 12K 6'40\"로 다 같이 완주! 다음엔 하프 거리까지 늘려봐요", scope: 'crew', crew: 'mapo', hoursAgo: 110 },
      { key: 'noshow1', user: 'noshow', body: '오늘도 늦잠... 내일은 진짜 나간다', hoursAgo: 15 },
    ];
    posts.forEach((p) => {
      const author = USERS.find((u) => u.key === p.user)!;
      db.run(
        `INSERT INTO posts (id, user_id, run_id, body, photos, scope, region, crew_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [seededId('pst', p.key), uid(p.user), p.run?.id ?? null, p.body, toJson(p.photos ?? []), p.scope ?? 'region', author.home, p.crew ? cid(p.crew) : null, ago(p.hoursAgo * HOUR_MS)],
      );
    });
    const likes: [string, UserKey[]][] = [
      ['demo1', ['pacer', 'squirrel', 'breeze', 'dawn', 'minji']],
      ['pacer1', ['demo', 'sub4', 'breeze']],
      ['squirrel1', ['demo', 'admin']],
      ['minji1', ['demo', 'dawn', 'breeze', 'squirrel', 'pacer', 'admin']],
      ['dawn1', ['demo', 'breeze', 'minji']],
      ['admin1', ['demo', 'pacer', 'squirrel', 'dawn']],
      ['breeze1', ['demo']],
    ];
    likes.forEach(([p, users]) => users.forEach((u, i) => db.run('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)', [seededId('pst', p), uid(u), ago((10 - i) * HOUR_MS)])));
    const comments: [string, UserKey, string, number][] = [
      ['demo1', 'pacer', '페이스 좋네요! 내일 반포 번개 6분 조로 오세요 🙌', 18],
      ['demo1', 'squirrel', '망원 야경 최고죠', 17],
      ['demo1', 'noshow', '번개 끝나고 둘이 따로 한잔 어때요? 연락처 주세요', 16],
      ['minji1', 'demo', '축하해요!! 다음엔 같이 7K 가요 🎉', 30],
      ['minji1', 'dawn', '민지님 최고! 토요일에 봐요', 29],
      ['admin1', 'pacer', '공감합니다. 저희 번개도 한 줄 달리기 지킬게요', 70],
      ['pacer1', 'demo', '6분 조 신청했어요!', 20],
    ];
    comments.forEach(([p, u, body, h], i) =>
      db.run('INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)', [seededId('cmt', i), seededId('pst', p), uid(u), body, ago(h * HOUR_MS)]),
    );

    /* ---------- 신고 (운영자 확인용) ---------- */
    db.run(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, reason, detail, created_at) VALUES (?, ?, 'comment', ?, ?, 'dating', ?, ?)`,
      [seededId('rpt', 1), uid('demo'), seededId('cmt', 2), uid('noshow'), '러닝과 무관하게 따로 만나자고 연락처를 요구했어요', ago(15 * HOUR_MS)],
    );
    db.run(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, reason, detail, created_at) VALUES (?, ?, 'user', ?, ?, 'other', ?, ?)`,
      [seededId('rpt', 2), uid('dawn'), uid('noshow'), uid('noshow'), '번개 신청 후 연락 없이 두 번 불참했어요', ago(6 * DAY_MS)],
    );

    /* ---------- 데모 계정 알림 ---------- */
    const ntf: [string, string, string, string | null, number, boolean][] = [
      ['flash.request', "초보러너민지님이 '마포 야간 6K 수다런' 참여를 요청했어요", '판정: 무리 — 승인 여부를 정해 주세요', `/flash/${seededId('flr', 'f9')}`, 2, false],
      ['crew.notice', '[마포 새벽런] 한강 가을 하프레이스 단체 신청', '대회 탭의 "한강 가을 하프레이스"에서 참가 예정을 눌러 주세요', `/crews/${cid('mapo')}`, 5, false],
      ['mate.request', "초보러너민지님이 '10K 58분 목표 같이 달려요' 메이트를 신청했어요", '저도 같이 연습하고 싶어요!', `/races/${rid('winter')}?tab=mates`, 24, false],
      ['flash.match', '내 페이스에 맞는 번개: 퇴근 후 반포 10K 페이스런', "10km · 6'00\" · 반포한강공원", `/flash/${seededId('flr', 'f1')}`, 30, true],
      ['review.received', '새 매너 후기가 도착했어요', '시간 약속을 잘 지켜요, 러닝 매너가 좋아요', '/me', 6 * 24, true],
      ['race.new', '내 지역 새 대회: 한강 가을 하프레이스', '여의도한강공원 · 접수 중', `/races/${rid('hangang')}`, 20 * 24, true],
    ];
    ntf.forEach(([type, title, body, link, h, read], i) =>
      db.run('INSERT INTO notifications (id, user_id, type, title, body, link, data, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        seededId('ntf', i), uid('demo'), type, title, body, link, '{}', read ? ago((h - 1) * HOUR_MS) : null, ago(h * HOUR_MS),
      ]),
    );
    db.run('INSERT INTO notifications (id, user_id, type, title, body, link, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      seededId('ntf', 'dawn1'), uid('dawn'), 'crew.request', "노쇼왕님이 '마포 새벽런' 가입을 신청했어요", '새벽런 가입하고 싶어요! 이번엔 꼭 나갈게요', `/crews/${cid('mapo')}?tab=members`, '{}', ago(5 * HOUR_MS),
    ]);

    setMeta(db, 'seeded_at', ts(now));
  });

  return { users: USERS.length, runs: runs.length };
}

export const SEED_IDS = {
  user: uid,
  flash: (k: string) => seededId('flr', k),
  crew: (k: string) => seededId('crw', k),
  race: (k: string) => seededId('mrt', k),
  post: (k: string) => seededId('pst', k),
};
