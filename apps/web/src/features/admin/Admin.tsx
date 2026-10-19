import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Metric, ReportDto } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge, TrustBadge } from '../../components/Badge.tsx';
import { Button, LinkButton } from '../../components/Button.tsx';
import { Card, Section } from '../../components/Card.tsx';
import { StackedColumnChart } from '../../components/charts.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Field, FormError, Input, Textarea, Toggle } from '../../components/Field.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { EmptyState, ErrorState, ListSkeleton, Skeleton, Tabs } from '../../components/Misc.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { useDebounced } from '../../lib/hooks.ts';
import { formatYmd, percent, timeAgo } from '../../lib/format.ts';
import { RaceRow } from '../races/parts.tsx';

type Tab = 'metrics' | 'reports' | 'users' | 'races';

function md(iso: string, addDays = 0) {
  const d = new Date(Date.parse(iso) + 9 * 3600_000 + addDays * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function MetricTile({ m, primary }: { m: Metric; primary?: boolean }) {
  const value = m.value == null ? '—' : m.format === 'percent' ? percent(m.value) : m.value.toLocaleString('ko-KR');
  return (
    <Card className={primary ? 'p-4' : 'p-3.5'}>
      <div className="text-[13px] font-semibold text-ink-2">{m.label}</div>
      <div className={primary ? 'mt-1.5 font-num text-[32px] font-bold leading-none text-ink' : 'mt-1 font-num text-[22px] font-semibold leading-tight text-ink'}>{value}</div>
      {m.denominator != null && (
        <div className="mt-1 font-num text-[12.5px] text-muted">
          {m.numerator}/{m.denominator}
        </div>
      )}
      {primary && <p className="mt-2 text-[12.5px] leading-snug text-muted">{m.description}</p>}
    </Card>
  );
}

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  const tab: Tab = t === 'reports' || t === 'users' || t === 'races' ? t : 'metrics';
  const metrics = useApiQuery('admin.metrics', {}, { enabled: tab === 'metrics' });
  const openReports = useApiQuery('reports.list', { status: 'open' });

  return (
    <div>
      <TopBar title="운영" back="/me" />
      <Page wide className="space-y-6">
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'metrics' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'metrics', label: '핵심 지표' },
            { value: 'reports', label: '신고', count: openReports.data?.length },
            { value: 'users', label: '회원' },
            { value: 'races', label: '대회' },
          ]}
        />

        {tab === 'metrics' &&
          (metrics.isLoading ? (
            <Skeleton className="h-80" />
          ) : metrics.error || !metrics.data ? (
            <ErrorState message={metrics.error?.message ?? '지표를 불러오지 못했어요'} onRetry={() => void metrics.refetch()} />
          ) : (
            <div className="space-y-8">
              <Section title="사업 검증 지표 (최근 8주)">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.data.core.map((m) => (
                    <MetricTile key={m.key} m={m} primary />
                  ))}
                </div>
              </Section>
              <Section title="주간 번개 성사">
                <Card className="p-4">
                  <StackedColumnChart
                    title="주간 번개 성사 현황"
                    primaryLabel="성사"
                    restLabel="미성사·취소"
                    data={metrics.data.weekly.map((w) => ({
                      label: md(w.weekStart, 1),
                      primary: w.realized,
                      rest: Math.max(0, w.created - w.realized),
                      detail: `${md(w.weekStart, 1)}~${md(w.weekStart, 7)}`,
                    }))}
                  />
                </Card>
              </Section>
              <Section title="서비스 현황">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {metrics.data.counts.map((m) => (
                    <MetricTile key={m.key} m={m} />
                  ))}
                </div>
              </Section>
              <p className="px-1 text-[12.5px] text-muted">{formatYmd(metrics.data.generatedAt.slice(0, 10))} 기준 · 데모 데이터는 예시 수치예요.</p>
            </div>
          ))}

        {tab === 'reports' && <ReportsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'races' && <RacesTab />}
      </Page>
    </div>
  );
}

const TARGET_LABEL: Record<string, string> = { user: '사용자', post: '게시글', comment: '댓글', flash_run: '번개', crew: '크루', mate_post: '메이트 모집' };

function ReportsTab() {
  const [status, setStatus] = useState<'open' | 'upheld' | 'dismissed' | 'all'>('open');
  const list = useApiQuery('reports.list', { status });
  const [target, setTarget] = useState<ReportDto | null>(null);
  return (
    <div className="space-y-4">
      <Segmented
        value={status}
        onChange={setStatus}
        size="sm"
        options={[
          { value: 'open', label: '처리 대기' },
          { value: 'upheld', label: '조치함' },
          { value: 'dismissed', label: '기각' },
          { value: 'all', label: '전체' },
        ]}
      />
      {list.isLoading ? (
        <ListSkeleton />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState icon="shield" title="처리할 신고가 없어요" />
      ) : (
        <div className="space-y-3">
          {list.data!.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="bad">{r.reason}</Badge>
                <Badge tone="neutral">{TARGET_LABEL[r.targetType] ?? r.targetType}</Badge>
                {r.status !== 'open' && <Badge tone={r.status === 'upheld' ? 'ok' : 'neutral'}>{r.status === 'upheld' ? '조치함' : '기각'}</Badge>}
                <span className="ml-auto text-[12.5px] text-muted">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-2 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink">{r.targetPreview}</p>
              {r.detail && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">“{r.detail}”</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span>신고 {r.reporter.nickname}</span>
                {r.targetUser && (
                  <Link to={`/users/${r.targetUser.id}`} className="flex items-center gap-1 text-ink-2 hover:underline">
                    대상 {r.targetUser.nickname} <TrustBadge score={r.targetUser.trustScore} grade={r.targetUser.trustGrade} compact />
                  </Link>
                )}
              </div>
              {r.resolution && <p className="mt-2 text-[13px] text-ink-2">처리: {r.resolution}</p>}
              {r.status === 'open' && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setTarget(r)}>
                  처리하기
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
      <ResolveSheet report={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function ResolveSheet({ report, onClose }: { report: ReportDto | null; onClose: () => void }) {
  const [action, setAction] = useState<'uphold' | 'dismiss'>('uphold');
  const [resolution, setResolution] = useState('');
  const [hide, setHide] = useState(true);
  const [suspend, setSuspend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolve = useApiMutation('reports.resolve', {
    successMessage: '신고를 처리하고 신고자에게 알렸어요',
    onSuccess: () => {
      setResolution('');
      onClose();
    },
    onError: (e) => {
      setError(e.message);
      return true;
    },
  });
  const canHide = report && ['post', 'comment', 'mate_post'].includes(report.targetType);
  return (
    <Sheet
      open={report != null}
      onClose={onClose}
      title="신고 처리"
      footer={
        <Button
          size="lg"
          block
          variant={action === 'uphold' ? 'danger' : 'primary'}
          loading={resolve.isPending}
          onClick={() => report && resolve.mutate({ id: report.id, action, resolution: resolution.trim(), hideContent: action === 'uphold' && !!canHide && hide, suspendUser: action === 'uphold' && suspend })}
        >
          {action === 'uphold' ? '조치하기' : '기각하기'}
        </Button>
      }
    >
      {report && (
        <div className="space-y-4">
          <p className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px]">
            <b>{report.reason}</b> · {report.targetPreview}
          </p>
          <Segmented
            value={action}
            onChange={setAction}
            options={[
              { value: 'uphold', label: '신고 인정' },
              { value: 'dismiss', label: '기각' },
            ]}
          />
          {action === 'uphold' && (
            <div className="rounded-2xl border border-line px-4 py-1">
              {canHide && <Toggle checked={hide} onChange={setHide} label="콘텐츠 숨기기" />}
              {report.targetUser && <Toggle checked={suspend} onChange={setSuspend} label={`${report.targetUser.nickname} 계정 정지`} description="로그인과 활동이 막혀요. 회원 탭에서 풀 수 있어요" />}
              {report.reason === '노쇼 기록 이의 제기' && <p className="py-2 text-[13px] text-ink-2">인정하면 신고자의 노쇼 기록이 참석으로 바뀌어요.</p>}
            </div>
          )}
          <Field label="처리 내용 (신고자에게 전달돼요)">
            {(id) => <Textarea id={id} rows={3} maxLength={300} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="예: 운영 정책 위반으로 게시글을 숨겼어요" />}
          </Field>
          <FormError message={error} />
        </div>
      )}
    </Sheet>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const users = useApiQuery('admin.users', { q: term || undefined });
  const setStatus = useApiMutation('admin.setUserStatus', { successMessage: '계정 상태를 바꿨어요' });
  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임이나 이메일로 찾기" aria-label="회원 검색" />
      {users.isLoading ? (
        <ListSkeleton />
      ) : (
        <Card className="divide-y divide-line p-0">
          {users.data?.map((u) => (
            <div key={u.user.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar avatar={u.user.avatar} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link to={`/users/${u.user.id}`} className="truncate text-[15px] font-semibold text-ink hover:underline">
                    {u.user.nickname}
                  </Link>
                  {u.role === 'admin' && <Badge tone="navy">운영자</Badge>}
                  {u.status === 'suspended' && <Badge tone="bad">정지</Badge>}
                </div>
                <div className="truncate text-[12.5px] text-muted">
                  {u.email} · 신뢰 {u.user.trustScore}
                </div>
              </div>
              {u.role !== 'admin' &&
                (u.status === 'suspended' ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ userId: u.user.id, status: 'active' })}>
                    정지 해제
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setStatus.mutate({ userId: u.user.id, status: 'suspended' })}>
                    정지
                  </Button>
                ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function RacesTab() {
  const races = useApiQuery('races.list', { scope: 'all', status: 'all' });
  return (
    <div className="space-y-4">
      <LinkButton to="/admin/races/new" icon="plus" block>
        대회 등록
      </LinkButton>
      <p className="px-1 text-[13px] leading-relaxed text-muted">
        대회를 등록하면 그 지역을 러닝 가능 지역으로 정한 사용자에게 바로 알림이 가요. 접수 일정은 공식 요강을 확인해 정확히 입력해 주세요.
      </p>
      {races.isLoading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-3">
          {races.data?.map((r, i) => (
            <div key={r.id} className="relative">
              <RaceRow race={r} index={i} />
              <Link to={`/admin/races/new?edit=${r.id}`} className="absolute bottom-3 right-14 z-20 flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink-2 hover:bg-brand-tint">
                <Icon name="edit" size={14} /> 수정
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
