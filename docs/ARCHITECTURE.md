# 런하이 구조

## 한 벌의 서비스 코드, 두 가지 실행 방식

```
                    ┌──────────────────────── packages/core ─────────────────────────┐
                    │ domain (지역·장소·DTO)  stats (레벨·판정·신뢰·GPS·GPX)           │
                    │ db (스키마·마이그레이션, Db 인터페이스)  services (RPC 메서드)     │
                    │ runScheduledJobs (접수 알림·번개 리마인더·크루 알림)  seed (데모)  │
                    └───────────────▲───────────────────────────────▲─────────────────┘
                                    │ execute(deps, userId, name, input)
              서버 모드             │                               │            데모 모드
┌─────────────── apps/server ───────┴──────┐        ┌──────────────── apps/web ──────┴──────────────┐
│ Fastify  POST /api/rpc/:method            │  HTTP  │ HttpApi ──────────────▶ (서버 모드)            │
│ JWT(HS256) · 요청 제한 · 업로드 저장       │◀───────│ LocalApi: sql.js(WASM) + IndexedDB 저장        │
│ better-sqlite3 (WAL) · 1분 예약 작업       │        │ React 화면 · Capacitor(Android 플러그인)        │
└───────────────────────────────────────────┘        └───────────────────────────────────────────────┘
```

- **서비스 계층은 하나**입니다. `packages/core/src/services/*`의 메서드는 `Deps`(DB, 시계, 미디어 저장소, 문자 발송, 데모 여부)만 받아서 동작하므로, 서버에서는 better-sqlite3로, 브라우저·Android 앱에서는 sql.js로 똑같이 실행됩니다.
- **데모 모드**(기본): 앱이 처음 열릴 때 기기 안 SQLite에 예시 데이터를 만들고 IndexedDB에 저장합니다. 서버가 없어도 승인·출석·알림 흐름을 여러 계정으로 바꿔 가며 확인할 수 있어요. 예약 작업은 앱이 열려 있는 동안 1분마다 돕니다.
- **서버 모드**: `VITE_API_URL`로 빌드하거나 앱의 설정 → 연결에서 서버 주소를 넣으면 같은 화면이 HTTP로 서버를 부릅니다.

## RPC

```ts
// packages/core/src/rpc/define.ts
query('user', z.object({ id: idSchema }), (ctx, input) => ...)     // 읽기
mutation('admin', z.object({...}), (ctx, input) => ...)           // 쓰기
```

- 메서드 이름(`flash.join`, `crews.apply` …)과 zod 입력 스키마, 권한(`public` / `user` / `admin`)을 한곳에 정의합니다.
- 입력·출력 타입이 레지스트리에서 추론되어 웹의 `api.call('flash.join', {...})`이 타입 검사됩니다.
- 오류는 `AppError(code, message, reason, details)`로 통일했습니다. 예) 경고 확인이 필요하면 `PRECONDITION / WARNING_CONFIRM_REQUIRED`와 판정 결과를 돌려줍니다.
- 서버는 `POST /api/rpc/:method` 하나로 받습니다. 로그인·가입 응답에만 토큰이 붙고, 나머지는 `Authorization: Bearer`로 사용자 확인.

## 데이터

SQLite 한 파일(`packages/core/src/db/schema.ts`)입니다.

| 영역 | 테이블 |
|---|---|
| 사용자 | users (공개 범위·알림 설정·동의·휴대폰 해시), follows, blocks, phone_verifications |
| 기록 | runs (출처, 인증 여부, 경로, 인증 제외 사유) |
| 피드 | posts, post_likes, comments |
| 번개 | flash_runs, flash_run_groups, flash_run_participants (판정·경고 확인·통계 공유·출석·완주), manner_reviews |
| 크루 | crews, crew_members, crew_notices, crew_schedules, crew_events, crew_event_attendance, crew_dues |
| 대회 | marathons, marathon_follows (알림·계획·종목), mate_posts, mate_members |
| 운영 | notifications (중복 방지 키), reports |

레벨·신뢰 점수는 저장하지 않고 요청할 때 기록에서 계산합니다(요청 안에서는 메모이즈). 번개를 열 때의 호스트 통계만 스냅숏으로 저장해 “개설 당시 공개한 수치”를 남깁니다.

## 알림

- 서비스 코드가 `notifications`에 쌓고(사용자 알림 설정 반영, `dedupe_key`로 중복 방지), 앱은 알림 화면과 배지로 보여 줍니다.
- 시간이 정해진 알림(접수 오픈 하루 전·10분 전·오픈 시각, 번개 2시간 전, 크루 일정 2시간 전, 출석 체크 요청)은 `runScheduledJobs`가 1분마다 만듭니다.
- Android 앱은 같은 일정을 **기기 예약 알림**(Capacitor Local Notifications)으로도 걸어 두어, 앱을 닫아도 정확한 시각에 울립니다. 앱이 다시 열릴 때마다 예약을 맞춥니다.

## 보안·개인정보

- 비밀번호: PBKDF2-SHA256 6만 회 + 솔트. 휴대폰 번호: SHA-256 해시와 끝 4자리만 저장.
- JWT 비밀키는 운영 환경에서 필수(`JWT_SECRET`), 인증 관련 메서드는 분당 20회 제한.
- 업로드 이미지는 매직 바이트로 형식 확인(JPEG·PNG·WebP), 5MB 이하만 저장. 앱은 올리기 전에 긴 변 1280px로 줄여요.
- 공개 범위는 서비스 계층에서 적용합니다(`userCard`, `users.profile`, `runs.list` 등). 차단 관계는 목록·상세·신청 모두에서 걸러요.
- 데모 모드에서만 휴대폰 인증번호를 응답에 포함합니다(`DEMO_MODE=false`면 포함하지 않음).

## Android (Capacitor)

| 기능 | 구현 |
|---|---|
| GPS 측정 | `@capacitor/geolocation` watchPosition, 화면 꺼짐 방지(Wake Lock), 측정 중 기록을 기기에 임시 저장해 앱을 다시 열면 이어서 저장 |
| 헬스 커넥트 | `capacitor-health` — 러닝 운동·거리·경로만 요청. 플러그인이 선언한 나머지 건강 권한은 매니페스트에서 제거 |
| 예약 알림 | `@capacitor/local-notifications` (알림 아이콘 `ic_stat_runhigh`) |
| 공유 | `@capacitor/share` — 번개·크루·대회·위치 공유 |
| 뒤로 가기 | 열린 시트를 먼저 닫고, 첫 화면이면 앱 종료 |
| 상태 표시줄 | 진한 머리 영역(번개·크루·대회 상세, GPS 측정)에서는 밝은 아이콘으로 바꿈 |

## 테스트

| 종류 | 위치 | 내용 |
|---|---|---|
| 단위 | `packages/core/test/stats.test.ts` 등 | 페이스·Riegel·레벨·판정 경계값·신뢰 점수·GPS 일시정지 구간·GPX/TCX·지역 |
| 서비스 통합 | `packages/core/test/services.test.ts` | sql.js 메모리 DB로 가입·번개(바로 참여/경고/승인/출석/후기)·크루·대회 알림 시각·배번 차단·신고 |
| API | `apps/server/test/app.test.ts` | Fastify inject로 인증·권한·업로드·예약 작업 |
| 웹 단위 | `apps/web/src/lib/format.test.ts` | 한국 시간 표시, 샘플 GPX |
| E2E | `apps/web/e2e/*.spec.ts` | Playwright로 데모 모드 빌드를 띄워 가입·본인인증·번개 참여/승인/개설·크루 승인·대회 알림·피드·기록·GPS·운영·레이아웃 |
