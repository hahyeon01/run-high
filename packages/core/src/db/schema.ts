import type { Db } from './types.ts';

/**
 * 순서대로 적용되는 마이그레이션. 이미 배포된 항목은 수정하지 말고 새 항목을 추가하세요.
 */
export const MIGRATIONS: string[] = [
  /* v1 — 초기 스키마 */
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
    birth_date TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    home_region TEXT NOT NULL,
    run_regions TEXT NOT NULL DEFAULT '[]',
    avatar TEXT NOT NULL DEFAULT '{}',
    bio TEXT NOT NULL DEFAULT '',
    privacy TEXT NOT NULL DEFAULT '{}',
    notify_prefs TEXT NOT NULL DEFAULT '{}',
    self_reported TEXT NOT NULL DEFAULT '{}',
    consents TEXT NOT NULL DEFAULT '{}',
    phone_hash TEXT,
    phone_last4 TEXT,
    phone_verified_at TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX idx_users_phone ON users(phone_hash) WHERE phone_hash IS NOT NULL;

  CREATE TABLE follows (
    follower_id TEXT NOT NULL,
    followee_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, followee_id)
  );
  CREATE INDEX idx_follows_followee ON follows(followee_id);

  CREATE TABLE blocks (
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );

  CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    distance_m INTEGER NOT NULL,
    duration_s INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gps', 'import', 'health', 'manual')),
    verified INTEGER NOT NULL DEFAULT 0,
    source_detail TEXT,
    external_id TEXT,
    route TEXT,
    title TEXT,
    note TEXT,
    problems TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_runs_user_started ON runs(user_id, started_at);
  CREATE UNIQUE INDEX idx_runs_external ON runs(user_id, external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    run_id TEXT,
    body TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    scope TEXT NOT NULL CHECK (scope IN ('region', 'followers', 'crew')),
    region TEXT NOT NULL,
    crew_id TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_posts_created ON posts(created_at);
  CREATE INDEX idx_posts_user ON posts(user_id, created_at);
  CREATE INDEX idx_posts_crew ON posts(crew_id, created_at);

  CREATE TABLE post_likes (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_comments_post ON comments(post_id, created_at);

  CREATE TABLE flash_runs (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL,
    region TEXT NOT NULL,
    place TEXT NOT NULL,
    distance_km REAL NOT NULL,
    gender_rule TEXT NOT NULL DEFAULT 'any' CHECK (gender_rule IN ('any', 'male', 'female')),
    age_min INTEGER,
    age_max INTEGER,
    allow_minors INTEGER NOT NULL DEFAULT 0,
    min_trust INTEGER,
    host_stats TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled', 'completed')),
    cancel_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX idx_flash_starts ON flash_runs(starts_at);
  CREATE INDEX idx_flash_host ON flash_runs(host_id);

  CREATE TABLE flash_run_groups (
    id TEXT PRIMARY KEY,
    flash_run_id TEXT NOT NULL,
    name TEXT NOT NULL,
    pace_s INTEGER NOT NULL,
    capacity INTEGER NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_flash_groups_run ON flash_run_groups(flash_run_id);

  CREATE TABLE flash_run_participants (
    flash_run_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'pending', 'rejected', 'cancelled', 'attended', 'no_show')),
    completed INTEGER,
    eligibility TEXT NOT NULL,
    eligibility_detail TEXT NOT NULL DEFAULT '{}',
    warning_confirmed INTEGER NOT NULL DEFAULT 0,
    share_stats INTEGER NOT NULL DEFAULT 1,
    message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    decided_at TEXT,
    PRIMARY KEY (flash_run_id, user_id)
  );
  CREATE INDEX idx_frp_user ON flash_run_participants(user_id);

  CREATE TABLE manner_reviews (
    id TEXT PRIMARY KEY,
    flash_run_id TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    reviewee_id TEXT NOT NULL,
    positive TEXT NOT NULL DEFAULT '[]',
    negative TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    UNIQUE (flash_run_id, reviewer_id, reviewee_id)
  );
  CREATE INDEX idx_reviews_reviewee ON manner_reviews(reviewee_id);

  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_user_id TEXT,
    reason TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
    resolution TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_reports_status ON reports(status, created_at);

  CREATE TABLE crews (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL,
    areas TEXT NOT NULL DEFAULT '[]',
    leader_id TEXT NOT NULL,
    conditions TEXT NOT NULL DEFAULT '{}',
    max_members INTEGER NOT NULL DEFAULT 50,
    dues_amount INTEGER,
    color TEXT NOT NULL DEFAULT 'violet',
    emoji TEXT NOT NULL DEFAULT '🏃',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE crew_members (
    crew_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'manager', 'member')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'left', 'removed')),
    message TEXT NOT NULL DEFAULT '',
    share_stats INTEGER NOT NULL DEFAULT 1,
    requested_at TEXT NOT NULL,
    joined_at TEXT,
    decided_at TEXT,
    PRIMARY KEY (crew_id, user_id)
  );
  CREATE INDEX idx_crew_members_user ON crew_members(user_id);

  CREATE TABLE crew_notices (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_crew_notices ON crew_notices(crew_id, created_at);

  CREATE TABLE crew_schedules (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    title TEXT NOT NULL,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    time TEXT NOT NULL,
    place TEXT NOT NULL,
    distance_km REAL NOT NULL,
    pace_s INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE crew_events (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    schedule_id TEXT,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    place TEXT NOT NULL,
    distance_km REAL NOT NULL,
    pace_s INTEGER,
    cancelled INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (schedule_id, starts_at)
  );
  CREATE INDEX idx_crew_events ON crew_events(crew_id, starts_at);

  CREATE TABLE crew_event_attendance (
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rsvp TEXT CHECK (rsvp IN ('going', 'not_going')),
    attended INTEGER,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (event_id, user_id)
  );

  CREATE TABLE crew_dues (
    crew_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    period TEXT NOT NULL,
    amount INTEGER NOT NULL,
    paid_at TEXT NOT NULL,
    marked_by TEXT NOT NULL,
    PRIMARY KEY (crew_id, user_id, period)
  );

  CREATE TABLE marathons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organizer TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL,
    venue TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL,
    start_time TEXT,
    courses TEXT NOT NULL DEFAULT '[]',
    registration_opens_at TEXT,
    registration_closes_at TEXT,
    registration_method TEXT NOT NULL DEFAULT 'first_come' CHECK (registration_method IN ('first_come', 'lottery')),
    registration_url TEXT,
    homepage TEXT,
    description TEXT NOT NULL DEFAULT '',
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_marathons_date ON marathons(event_date);

  CREATE TABLE marathon_follows (
    marathon_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    alert INTEGER NOT NULL DEFAULT 0,
    plan TEXT CHECK (plan IN ('interested', 'going')),
    course TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (marathon_id, user_id)
  );
  CREATE INDEX idx_marathon_follows_user ON marathon_follows(user_id);

  CREATE TABLE mate_posts (
    id TEXT PRIMARY KEY,
    marathon_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('pace', 'travel')),
    course TEXT,
    goal_time_s INTEGER,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    travel TEXT NOT NULL DEFAULT '{}',
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_mate_posts ON mate_posts(marathon_id, created_at);

  CREATE TABLE mate_members (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    decided_at TEXT,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    dedupe_key TEXT UNIQUE,
    read_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_notifications_user ON notifications(user_id, created_at);

  CREATE TABLE phone_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone_hash TEXT NOT NULL,
    phone_last4 TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_phone_verifications_user ON phone_verifications(user_id, created_at);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function migrate(db: Db): { from: number; to: number } {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const row = db.get<{ value: string }>(`SELECT value FROM meta WHERE key = 'schema_version'`);
  const from = row ? Number(row.value) : 0;
  for (let v = from; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.run(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(v + 1)],
      );
    });
  }
  return { from, to: MIGRATIONS.length };
}

export function getMeta(db: Db, key: string): string | null {
  return db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key])?.value ?? null;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.run(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
}
