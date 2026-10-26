import { describe, expect, it } from 'vitest';
import { SEED_IDS } from '../src/seed/demo.ts';
import { HOUR_MS, DAY_MS } from '../src/util/time.ts';
import { createEnv, expectAppError } from './helpers.ts';

const U = SEED_IDS.user;
const F = SEED_IDS.flash;

const signupInput = (over: Record<string, unknown> = {}) => ({
  email: 'new@runhigh.app',
  password: 'abcd1234',
  nickname: '새러너',
  birthDate: '1995-05-05',
  gender: 'male' as const,
  homeRegion: '서울 마포구',
  runRegions: ['서울 마포구', '서울'],
  consents: { terms: true as const, privacy: true as const, location: true as const, health: true as const, manners: true as const, marketing: false },
  ...over,
});

describe('seed data', () => {
  it('produces the expected eligibility for the demo account', async () => {
    const env = await createEnv();
    const f1 = await env.call(U('demo'), 'flash.get', { id: F('f1') });
    expect(f1.groups[0].myEligibility?.level).toBe('eligible');
    expect(f1.groups[1].myEligibility?.level).toBe('challenge');
    expect(f1.my.bestEligibility).toBe('eligible');

    const f5 = await env.call(U('demo'), 'flash.get', { id: F('f5') });
    expect(f5.groups[0].myEligibility?.level).toBe('hard');
    const f2 = await env.call(U('demo'), 'flash.get', { id: F('f2') });
    expect(f2.groups[0].myEligibility?.level).toBe('hard');
    const f4 = await env.call(U('demo'), 'flash.get', { id: F('f4') });
    expect(f4.my.restriction).toBeNull();
    expect(f4.groups[0].myEligibility?.level).toBe('eligible');
  });

  it('every open flash run has a host who can guarantee the host group target', async () => {
    const env = await createEnv();
    const runs = env.deps.db.all<{ id: string; host_id: string }>(`SELECT id, host_id FROM flash_runs WHERE status = 'open'`);
    expect(runs.length).toBeGreaterThanOrEqual(10);
    for (const r of runs) {
      const d = await env.call(r.host_id, 'flash.get', { id: r.id });
      expect(['eligible', 'challenge'], d.title).toContain(d.groups[0].hostEligibility);
      const check = await env.call(r.host_id, 'flash.hostCheck', {});
      expect(check.problems, d.title).toEqual([]);
    }
  });

  it('gives the no-show user a caution trust grade', async () => {
    const env = await createEnv();
    const t = await env.call(U('demo'), 'users.trust', { userId: U('noshow') });
    expect(t.grade).toBe('caution');
    const mine = await env.call(U('demo'), 'users.trust', {});
    expect(mine.score).toBeGreaterThan(80);
  });
});

describe('auth & profile', () => {
  it('signs up with validation and logs in', async () => {
    const env = await createEnv();
    await expectAppError(env.call(null, 'auth.signup', signupInput({ birthDate: '2015-01-01' })), 'VALIDATION');
    await expectAppError(
      env.call(null, 'auth.signup', signupInput({ consents: { terms: true, privacy: true, location: false, health: true, manners: true } })),
      'VALIDATION',
    );
    await expectAppError(env.call(null, 'auth.signup', signupInput({ email: 'demo@runhigh.app' })), 'CONFLICT');
    await expectAppError(env.call(null, 'auth.signup', signupInput({ nickname: '한강러너' })), 'CONFLICT');
    await expectAppError(env.call(null, 'auth.signup', signupInput({ password: 'short' })), 'VALIDATION');

    const { user } = await env.call(null, 'auth.signup', signupInput());
    expect(user.nickname).toBe('새러너');
    expect(user.isMinor).toBe(false);
    expect(user.runRegions).toEqual(['서울 마포구', '서울']);
    expect(user.privacy.stats).toBe('on_apply');

    await expectAppError(env.call(null, 'auth.login', { email: 'new@runhigh.app', password: 'wrong123' }), 'UNAUTHORIZED');
    const login = await env.call(null, 'auth.login', { email: 'NEW@runhigh.app', password: 'abcd1234' });
    expect(login.user.id).toBe(user.id);
    await expectAppError(env.call(null, 'auth.me', {}), 'UNAUTHORIZED');
  });

  it('verifies a phone number with a code', async () => {
    const env = await createEnv();
    const { user } = await env.call(null, 'auth.signup', signupInput());
    expect(user.phoneVerified).toBe(false);
    await expectAppError(env.call(user.id, 'users.requestPhoneCode', { phone: '02-123-4567' }), 'VALIDATION');
    const res = await env.call(user.id, 'users.requestPhoneCode', { phone: '010-1234-5678' });
    expect(res.debugCode).toMatch(/^\d{6}$/);
    expect(env.sms.last).toContain(res.debugCode!);
    await expectAppError(env.call(user.id, 'users.confirmPhoneCode', { code: res.debugCode === '000000' ? '111111' : '000000' }), 'VALIDATION');
    const me = await env.call(user.id, 'users.confirmPhoneCode', { code: res.debugCode! });
    expect(me.phoneVerified).toBe(true);
    expect(me.phoneLast4).toBe('5678');

    // 같은 번호로 다른 계정 인증 불가
    const other = await env.call(null, 'auth.signup', signupInput({ email: 'other@runhigh.app', nickname: '다른러너' }));
    await expectAppError(env.call(other.user.id, 'users.requestPhoneCode', { phone: '01012345678' }), 'CONFLICT');
  });

  it('hides stats unless the user makes them public', async () => {
    const env = await createEnv();
    const minji = await env.call(U('demo'), 'users.profile', { userId: U('minji') });
    expect(minji.level).toBeNull();
    expect(minji.user.level).toBeNull();
    const pacer = await env.call(U('demo'), 'users.profile', { userId: U('pacer') });
    expect(pacer.level?.status).toBe('ok');
    await env.call(U('minji'), 'users.updatePrivacy', { stats: 'public' });
    const minji2 = await env.call(U('demo'), 'users.profile', { userId: U('minji') });
    expect(minji2.level?.status).toBe('ok');
  });
});

describe('runs', () => {
  it('imports GPX as verified and keeps manual runs out of the level', async () => {
    const env = await createEnv();
    const { user } = await env.call(null, 'auth.signup', signupInput());
    const start = Date.parse('2026-10-14T21:00:00Z');
    const pts = Array.from({ length: 601 }, (_, i) =>
      `<trkpt lat="${37.5 + (i * 10) / 111_195}" lon="127"><time>${new Date(start + i * 3300).toISOString()}</time></trkpt>`,
    ).join('');
    const gpx = `<?xml version="1.0"?><gpx><trk><name>아침런</name><type>running</type><trkseg>${pts}</trkseg></trk></gpx>`;
    const run = await env.call(user.id, 'runs.importFile', { fileName: 'morning.gpx', text: gpx });
    expect(run.verified).toBe(true);
    expect(run.source).toBe('import');
    expect(run.route?.length).toBeGreaterThan(1);
    await expectAppError(env.call(user.id, 'runs.importFile', { fileName: 'morning.gpx', text: gpx }), 'CONFLICT');

    const manual = await env.call(user.id, 'runs.createManual', { startedAt: '2026-10-13T21:00:00Z', distanceKm: 21.1, durationS: 7000 });
    expect(manual.verified).toBe(false);
    const level = await env.call(user.id, 'runs.level', {});
    expect(level?.verifiedRunCount).toBe(1);
    expect(level?.unverifiedRunCount).toBe(1);
    expect(level?.status).toBe('insufficient');
  });

  it('saves GPS tracks and imports Health Connect workouts once', async () => {
    const env = await createEnv();
    const t0 = Date.parse('2026-10-15T01:00:00Z');
    const points = Array.from({ length: 300 }, (_, i) => ({ lat: 37.55 + (i * 10) / 111_195, lng: 126.9, t: t0 + i * 3500, acc: 8 }));
    const gps = await env.call(U('teen'), 'runs.saveGps', { points });
    expect(gps.verified).toBe(true);
    expect(gps.distanceM).toBeGreaterThan(2900);

    const workouts = [
      { id: 'w1', startDate: '2026-10-12T21:00:00Z', endDate: '2026-10-12T21:50:00Z', workoutType: 'RUNNING', distance: 8000, duration: 2900, sourceName: 'Galaxy Watch' },
      { id: 'w2', startDate: '2026-10-11T21:00:00Z', endDate: '2026-10-11T22:00:00Z', workoutType: 'BIKING', distance: 20000, duration: 3600 },
    ];
    const r1 = await env.call(U('teen'), 'runs.importHealth', { workouts });
    expect(r1).toMatchObject({ imported: 1, skipped: 1 });
    const r2 = await env.call(U('teen'), 'runs.importHealth', { workouts });
    expect(r2).toMatchObject({ imported: 0, skipped: 2 });
  });
});

describe('flash runs (번개)', () => {
  it('joins instantly when eligible and needs warning + approval otherwise', async () => {
    const env = await createEnv();
    const f1 = await env.call(U('demo'), 'flash.get', { id: F('f1') });
    const [groupA, groupB] = f1.groups;

    const preview = await env.call(U('demo'), 'flash.preview', { id: F('f1'), groupId: groupB.id });
    expect(preview.outcome).toBe('approval');
    expect(preview.eligibility.reasons.join(' ')).toContain('느려요');

    const joined = await env.call(U('demo'), 'flash.join', { id: F('f1'), groupId: groupA.id, agreeManners: true });
    expect(joined.status).toBe('confirmed');
    const hostNotes = env.deps.db.all<{ title: string }>(`SELECT title FROM notifications WHERE user_id = ? AND type = 'flash.joined'`, [U('pacer')]);
    expect(hostNotes.some((n) => n.title.includes('한강러너'))).toBe(true);

    // 무리한 그룹: 경고 확인 없이 → 거절, 확인 후 → 승인 대기
    const f5 = await env.call(U('demo'), 'flash.get', { id: F('f5') });
    const err = await expectAppError(
      env.call(U('demo'), 'flash.join', { id: F('f5'), groupId: f5.groups[0].id, agreeManners: true }),
      'PRECONDITION',
      'WARNING_CONFIRM_REQUIRED',
    );
    expect((err.details as { eligibility: { level: string } }).eligibility.level).toBe('hard');
    const pending = await env.call(U('demo'), 'flash.join', {
      id: F('f5'),
      groupId: f5.groups[0].id,
      agreeManners: true,
      confirmWarning: true,
      message: '열심히 따라갈게요',
    });
    expect(pending.status).toBe('pending');

    // 호스트는 신청자의 판정 근거를 볼 수 있음 (통계 공유 동의)
    const hostView = await env.call(U('pacer'), 'flash.get', { id: F('f5') });
    const req = hostView.participants.find((p) => p.user.id === U('demo'))!;
    expect(req.status).toBe('pending');
    expect(req.warningConfirmed).toBe(true);
    expect(req.eligibilityDetail?.level).toBe('hard');

    // 다른 참여자는 대기 중 신청을 볼 수 없음
    const otherView = await env.call(U('sub4'), 'flash.get', { id: F('f5') });
    expect(otherView.participants.find((p) => p.user.id === U('demo'))).toBeUndefined();

    await expectAppError(env.call(U('sub4'), 'flash.decide', { id: F('f5'), userId: U('demo'), approve: true }), 'FORBIDDEN');
    await env.call(U('pacer'), 'flash.decide', { id: F('f5'), userId: U('demo'), approve: true });
    const after = await env.call(U('demo'), 'flash.get', { id: F('f5') });
    expect(after.my.participation?.status).toBe('confirmed');
    const approved = env.deps.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'flash.approved'`, [U('demo')]);
    expect(approved?.n).toBe(1);
  });

  it('enforces gender, age, minor and phone restrictions', async () => {
    const env = await createEnv();
    const f4 = await env.call(U('pacer'), 'flash.get', { id: F('f4') });
    expect(f4.my.restriction).toContain('여성');
    await expectAppError(env.call(U('pacer'), 'flash.join', { id: F('f4'), groupId: f4.groups[0].id, agreeManners: true }), 'PRECONDITION', 'RESTRICTED');

    const teenF1 = await env.call(U('teen'), 'flash.get', { id: F('f1') });
    expect(teenF1.my.restriction).toContain('청소년');
    const teenF12 = await env.call(U('teen'), 'flash.get', { id: F('f12') });
    expect(teenF12.my.restriction).toBeNull();

    const f8 = await env.call(U('demo'), 'flash.get', { id: F('f8') });
    expect(f8.my.restriction).toContain('40세 이상');

    const { user } = await env.call(null, 'auth.signup', signupInput());
    const f3 = await env.call(user.id, 'flash.get', { id: F('f3') });
    await expectAppError(
      env.call(user.id, 'flash.join', { id: F('f3'), groupId: f3.groups[0].id, agreeManners: true }),
      'PRECONDITION',
      'PHONE_VERIFICATION_REQUIRED',
    );
  });

  it('validates hosting: stats refresh, place rules, host restrictions and guarantee', async () => {
    const env = await createEnv();
    const { user } = await env.call(null, 'auth.signup', signupInput());
    const check = await env.call(user.id, 'flash.hostCheck', {});
    expect(check.canHost).toBe(false);
    expect(check.problems.join(' ')).toContain('본인인증');

    const startsAt = new Date(env.clock.now.getTime() + 2 * DAY_MS).toISOString();
    const base = {
      title: '반포 트랙 6K',
      startsAt,
      place: { placeId: 'banpo-stadium', name: '반포종합운동장' },
      distanceKm: 6,
      groups: [{ paceS: 390, capacity: 6 }],
      agreeManners: true as const,
      confirmPublicPlace: true as const,
    };
    const ruleErr = await expectAppError(env.call(U('demo'), 'flash.create', base), 'VALIDATION');
    expect(ruleErr.message).toContain('4명');

    await expectAppError(
      env.call(U('demo'), 'flash.create', { ...base, groups: [{ paceS: 390, capacity: 4 }], restrictions: { gender: 'male', allowMinors: false } }),
      'VALIDATION',
    );
    const guarantee = await expectAppError(
      env.call(U('demo'), 'flash.create', { ...base, distanceKm: 10, groups: [{ paceS: 270, capacity: 4 }] }),
      'VALIDATION',
    );
    expect(guarantee.message).toContain('보증');

    const created = await env.call(U('demo'), 'flash.create', { ...base, groups: [{ paceS: 390, capacity: 4 }, { paceS: 420, capacity: 4 }] });
    const detail = await env.call(U('demo'), 'flash.get', { id: created.id });
    expect(detail.region).toBe('서울 서초구');
    expect(detail.placeRule?.maxGroupSize).toBe(4);
    expect(detail.hostStats.verifiedRunCount).toBeGreaterThanOrEqual(3);
    expect(detail.participants).toHaveLength(1);

    // 수준이 맞는 지역 러너에게 매칭 알림
    const matched = env.deps.db.all<{ user_id: string }>(`SELECT user_id FROM notifications WHERE type = 'flash.match' AND link = ?`, [`/flash/${created.id}`]);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.map((m) => m.user_id)).not.toContain(U('demo'));
  });

  it('hides the start and end of a route from other runners', async () => {
    const env = await createEnv();
    const mine = await env.call(U('pacer'), 'runs.list', {});
    const run = mine.items.find((r) => r.route && r.route.length > 10)!;
    expect(run.routePrivacy).toBe('full');
    const other = await env.call(U('demo'), 'runs.get', { id: run.id });
    expect(other.routePrivacy).toBe('trimmed');
    expect(other.route![0]).not.toEqual(run.route![0]);
    expect(other.route!.at(-1)).not.toEqual(run.route!.at(-1));
    expect(other.distanceM).toBe(run.distanceM);
    const own = await env.call(U('pacer'), 'runs.get', { id: run.id });
    expect(own.route).toEqual(run.route);
  });

  it('completes with attendance, records no-shows and accepts reviews', async () => {
    const env = await createEnv();
    // f9: 호스트 한강러너, 확정 한강바람, 대기 초보러너민지
    await env.call(U('demo'), 'flash.decide', { id: F('f9'), userId: U('minji'), approve: true });
    const before = (await env.call(U('demo'), 'users.trust', { userId: U('minji') })).score;
    await expectAppError(
      env.call(U('demo'), 'flash.complete', { id: F('f9'), attendance: [] }),
      'VALIDATION',
    );
    env.advance(2 * DAY_MS);
    await expectAppError(
      env.call(U('demo'), 'flash.complete', { id: F('f9'), attendance: [{ userId: U('breeze'), status: 'attended', completed: true }] }),
      'VALIDATION',
    );
    await env.call(U('demo'), 'flash.complete', {
      id: F('f9'),
      attendance: [
        { userId: U('breeze'), status: 'attended', completed: true },
        { userId: U('minji'), status: 'no_show' },
      ],
    });
    const detail = await env.call(U('breeze'), 'flash.get', { id: F('f9') });
    expect(detail.status).toBe('completed');
    expect(detail.permissions.canReview).toBe(true);

    await env.call(U('breeze'), 'flash.review', { id: F('f9'), revieweeId: U('demo'), positive: ['러닝 매너가 좋아요'] });
    await env.call(U('demo'), 'flash.review', { id: F('f9'), revieweeId: U('breeze'), positive: ['페이스를 잘 맞춰줘요'] });
    // 노쇼한 사람은 함께 달리지 않았으니 후기를 남길 수도, 받을 수도 없음
    await expectAppError(env.call(U('minji'), 'flash.review', { id: F('f9'), revieweeId: U('demo'), positive: ['러닝 매너가 좋아요'] }), 'FORBIDDEN');
    await expectAppError(env.call(U('breeze'), 'flash.review', { id: F('f9'), revieweeId: U('minji'), negative: ['약속 시간에 늦었어요'] }), 'VALIDATION');
    // 나 자신, 이 번개에 없던 사람
    await expectAppError(env.call(U('breeze'), 'flash.review', { id: F('f9'), revieweeId: U('breeze'), positive: ['러닝 매너가 좋아요'] }), 'VALIDATION');
    await expectAppError(env.call(U('breeze'), 'flash.review', { id: F('f9'), revieweeId: U('pacer'), positive: ['러닝 매너가 좋아요'] }), 'VALIDATION');
    await expectAppError(env.call(U('pacer'), 'flash.review', { id: F('f9'), revieweeId: U('demo'), positive: ['러닝 매너가 좋아요'] }), 'FORBIDDEN');
    const after = (await env.call(U('demo'), 'users.trust', { userId: U('minji') })).score;
    expect(after).toBeLessThan(before);
  });

  it('sends reminders and auto-closes stale runs through scheduled jobs', async () => {
    const env = await createEnv();
    env.clock.now = new Date(Date.parse((await env.call(U('demo'), 'flash.get', { id: F('f1') })).startsAt) - HOUR_MS);
    env.jobs();
    const reminders = env.deps.db.all<{ user_id: string }>(`SELECT user_id FROM notifications WHERE type = 'flash.reminder'`);
    expect(reminders.map((r) => r.user_id)).toEqual(expect.arrayContaining([U('pacer'), U('breeze')]));
    expect(env.jobs()).toBe(0); // 중복 없음
    env.advance(8 * DAY_MS);
    env.jobs();
    const f1 = env.deps.db.get<{ status: string }>('SELECT status FROM flash_runs WHERE id = ?', [F('f1')]);
    expect(f1?.status).toBe('completed');
  });
});

describe('crews', () => {
  it('applies with conditions and lets managers approve', async () => {
    const env = await createEnv();
    const songpa = SEED_IDS.crew('songpa');
    const detail = await env.call(U('demo'), 'crews.get', { id: songpa });
    expect(detail.permissions.canApply).toBe(true);
    await env.call(U('demo'), 'crews.apply', { id: songpa, message: '주말 브런치런 함께해요' });
    await expectAppError(env.call(U('demo'), 'crews.apply', { id: songpa }), 'CONFLICT');

    const pacerView = await env.call(U('pacer'), 'crews.get', { id: songpa });
    expect(pacerView.my.conditionProblems.join()).toContain('여성');
    await expectAppError(env.call(U('pacer'), 'crews.apply', { id: songpa }), 'PRECONDITION', 'RESTRICTED');

    const pending = await env.call(U('squirrel'), 'crews.members', { id: songpa, status: 'pending' });
    expect(pending.map((m) => m.user.id)).toContain(U('demo'));
    expect(pending[0].level?.status).toBe('ok');
    await expectAppError(env.call(U('demo'), 'crews.members', { id: songpa, status: 'pending' }), 'FORBIDDEN');
    await env.call(U('squirrel'), 'crews.decide', { id: songpa, userId: U('demo'), approve: true });
    const after = await env.call(U('demo'), 'crews.get', { id: songpa });
    expect(after.my.status).toBe('active');
    expect(after.notices.length).toBeGreaterThan(0);

    const banpo = await env.call(U('minji'), 'crews.get', { id: SEED_IDS.crew('banpo') });
    expect(banpo.my.conditionProblems.length).toBeGreaterThan(0);
  });

  it('materializes regular events, tracks RSVP, attendance and dues', async () => {
    const env = await createEnv();
    const mapo = SEED_IDS.crew('mapo');
    const events = await env.call(U('demo'), 'crews.events', { crewId: mapo });
    expect(events.length).toBeGreaterThanOrEqual(4);
    const ev = events[0];
    await env.call(U('demo'), 'crews.rsvp', { eventId: ev.id, rsvp: 'going' });
    await expectAppError(env.call(U('demo'), 'crews.markAttendance', { eventId: ev.id, attendees: [] }), 'FORBIDDEN');
    env.clock.now = new Date(Date.parse(ev.startsAt) + HOUR_MS);
    const res = await env.call(U('dawn'), 'crews.markAttendance', { eventId: ev.id, attendees: [U('demo'), U('dawn')] });
    expect(res.attended).toBe(2);

    const dues = await env.call(U('dawn'), 'crews.dues', { crewId: mapo });
    expect(dues.amount).toBe(10000);
    const minjiRow = dues.members.find((m) => m.user.id === U('minji'));
    expect(minjiRow?.paid).toBe(false);
    await env.call(U('dawn'), 'crews.markDues', { crewId: mapo, userId: U('minji'), period: dues.period, paid: true });
    const myDues = await env.call(U('minji'), 'crews.dues', { crewId: mapo, period: dues.period });
    expect(myDues.members).toHaveLength(1);
    expect(myDues.members[0].paid).toBe(true);

    const members = await env.call(U('dawn'), 'crews.members', { id: mapo });
    expect(members.find((m) => m.user.id === U('demo'))?.attendanceRate).not.toBeNull();
  });
});

describe('races', () => {
  it('sends registration-open alerts at D-1, 10 minutes before, and at opening', async () => {
    const env = await createEnv();
    const winter = SEED_IDS.race('winter');
    env.jobs();
    const titles = () => env.deps.db.all<{ title: string }>(`SELECT title FROM notifications WHERE user_id = ? AND type = 'race.open'`, [U('demo')]).map((n) => n.title);
    expect(titles().some((t) => /^(오늘|내일) \d{2}:\d{2} '서울 윈터 10K' 접수가 시작돼요/.test(t))).toBe(true);
    const race = await env.call(U('demo'), 'races.get', { id: winter });
    expect(race.status).toBe('upcoming');
    env.clock.now = new Date(Date.parse(race.registrationOpensAt!) - 5 * 60_000);
    env.jobs();
    expect(titles().some((t) => t.startsWith('10분 뒤'))).toBe(true);
    env.clock.now = new Date(Date.parse(race.registrationOpensAt!) + 60_000);
    env.jobs();
    expect(titles().some((t) => t.startsWith('지금'))).toBe(true);
    expect((await env.call(U('demo'), 'races.get', { id: winter })).status).toBe('open');
    const upcoming = await env.call(U('demo'), 'races.upcomingAlerts', {});
    expect(upcoming.map((u) => u.marathonId)).not.toContain(winter);
  });

  it('notifies runners in the region when an admin registers a race', async () => {
    const env = await createEnv();
    const input = {
      name: '망원 한강 나이트 10K',
      region: '서울 마포구',
      eventDate: '2026-12-20',
      courses: [{ key: '10k' as const, label: '10km', distanceKm: 10 }],
      registrationOpensAt: '2026-11-01T01:00:00Z',
    };
    await expectAppError(env.call(U('demo'), 'races.create', input), 'FORBIDDEN');
    const res = await env.call(U('admin'), 'races.create', input);
    expect(res.notified).toBeGreaterThan(0);
    const demoNote = env.deps.db.get<{ title: string }>(`SELECT title FROM notifications WHERE user_id = ? AND type = 'race.new' AND link = ?`, [
      U('demo'),
      `/races/${res.id}`,
    ]);
    expect(demoNote?.title).toContain('망원 한강 나이트 10K');
    const busanNote = env.deps.db.get(`SELECT 1 AS x FROM notifications WHERE user_id = ? AND link = ?`, [U('busan'), `/races/${res.id}`]);
    expect(busanNote).toBeUndefined();
  });

  it('blocks bib trading and evaluates pace-mate fit', async () => {
    const env = await createEnv();
    const hangang = SEED_IDS.race('hangang');
    await expectAppError(
      env.call(U('demo'), 'races.createMate', { marathonId: hangang, kind: 'travel', title: '하프 배번 양도합니다', body: '사정이 생겨서요' }),
      'VALIDATION',
    );
    const mates = await env.call(U('demo'), 'races.mates', { marathonId: hangang, kind: 'pace' });
    const twoHour = mates.find((m) => m.goalTimeS === 7200)!;
    expect(['hard', 'challenge']).toContain(twoHour.my.fit);
    await env.call(U('demo'), 'races.joinMate', { postId: twoHour.id, message: '같이 가요' });
    await env.call(U('squirrel'), 'races.decideMate', { postId: twoHour.id, userId: U('demo'), approve: true });
    const after = await env.call(U('demo'), 'races.mates', { marathonId: hangang, kind: 'pace' });
    expect(after.find((m) => m.id === twoHour.id)?.my.status).toBe('accepted');
  });
});

describe('feed, reports and admin', () => {
  it('shows region / following / crew feeds and hides blocked users', async () => {
    const env = await createEnv();
    const region = await env.call(U('demo'), 'feed.list', { tab: 'region' });
    expect(region.items.length).toBeGreaterThan(3);
    expect(region.items.every((p) => p.scope === 'region')).toBe(true);
    expect(region.items.some((p) => p.author.id === U('busan'))).toBe(false);

    const crew = await env.call(U('demo'), 'feed.list', { tab: 'crew' });
    expect(crew.items.length).toBeGreaterThan(0);
    expect(crew.items.every((p) => p.crew?.name === '마포 새벽런')).toBe(true);

    const following = await env.call(U('pacer'), 'feed.list', { tab: 'following' });
    expect(following.items.some((p) => p.body.includes('하프 준비'))).toBe(true);

    await env.call(U('demo'), 'users.block', { userId: U('noshow') });
    const region2 = await env.call(U('demo'), 'feed.list', { tab: 'region' });
    expect(region2.items.some((p) => p.author.id === U('noshow'))).toBe(false);
    const comments = await env.call(U('demo'), 'feed.comments', { postId: SEED_IDS.post('demo1') });
    expect(comments.some((c) => c.author.id === U('noshow'))).toBe(false);
  });

  it('creates posts, blocks bib trading and notifies likes', async () => {
    const env = await createEnv();
    await expectAppError(env.call(U('demo'), 'feed.create', { body: '서울 윈터 10K 배번 양도해요', scope: 'region' }), 'VALIDATION');
    const post = await env.call(U('demo'), 'feed.create', { body: '오늘 7K!', scope: 'region' });
    await env.call(U('pacer'), 'feed.like', { id: post.id, like: true });
    await env.call(U('pacer'), 'feed.like', { id: post.id, like: true });
    const notes = env.deps.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'like'`, [U('demo')]);
    expect(notes?.n).toBe(1);
  });

  it('auto-hides content after three reports and lets admins resolve', async () => {
    const env = await createEnv();
    const post = SEED_IDS.post('noshow1');
    for (const k of ['demo', 'minji', 'dawn'] as const) {
      await env.call(U(k), 'reports.create', { targetType: 'post', targetId: post, reason: 'spam' });
    }
    expect(env.deps.db.get<{ hidden: number }>('SELECT hidden FROM posts WHERE id = ?', [post])?.hidden).toBe(1);
    const open = await env.call(U('admin'), 'reports.list', { status: 'open' });
    expect(open.length).toBeGreaterThanOrEqual(5);
    const target = open.find((r) => r.targetId === post)!;
    await env.call(U('admin'), 'reports.resolve', { id: target.id, action: 'uphold', resolution: '스팸으로 확인', hideContent: true });
    await expectAppError(env.call(U('demo'), 'reports.list', { status: 'open' }), 'FORBIDDEN');
  });

  it('computes business metrics', async () => {
    const env = await createEnv();
    const m = await env.call(U('admin'), 'admin.metrics', {});
    const byKey = Object.fromEntries(m.core.map((c) => [c.key, c]));
    expect(byKey.realization.denominator).toBe(8);
    expect(byKey.realization.numerator).toBe(6);
    expect(byKey.no_show.numerator).toBe(3);
    expect(byKey.retention_4w.value).not.toBeNull();
    expect(byKey.warned_completion.denominator).toBe(4);
    expect(byKey.warned_completion.numerator).toBe(3);
    expect(m.weekly).toHaveLength(8);
  });
});
