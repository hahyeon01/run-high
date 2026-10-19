import { Link, useNavigate } from 'react-router';
import { TRUST_GRADE_LABELS, formatPace } from '@runhigh/core';
import { useApiQuery } from '../../api/hooks.ts';
import { useMe } from '../../api/session.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Badge, VerifiedMark } from '../../components/Badge.tsx';
import { IconButton, LinkButton } from '../../components/Button.tsx';
import { Card, Section } from '../../components/Card.tsx';
import { TopBar } from '../../components/Header.tsx';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { Skeleton } from '../../components/Misc.tsx';
import { cn } from '../../lib/cn.ts';
import { regionLabel } from '../../lib/format.ts';
import { CrewEmblem } from '../crews/parts.tsx';
import { TrustMeter } from './TrustMeter.tsx';

function MenuRow({ to, icon, label, detail }: { to: string; icon: IconName; label: string; detail?: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60">
      <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex-1 text-[15px] font-medium text-ink">{label}</span>
      {detail && <span className="text-[13px] text-muted">{detail}</span>}
      <Icon name="chevronRight" size={18} className="text-muted" />
    </Link>
  );
}

export function MyPage() {
  const me = useMe();
  const navigate = useNavigate();
  const profile = useApiQuery('users.profile', { userId: me.id });
  const p = profile.data;
  const lv = p?.level;

  return (
    <div>
      <TopBar title="마이페이지" large actions={<IconButton icon="setting" label="설정" onClick={() => navigate('/settings')} />} />
      <div className="mx-auto max-w-3xl space-y-7 px-4 pb-10 lg:px-6">
        <section className="flex items-center gap-4">
          <Avatar avatar={me.avatar} size={76} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[21px] font-bold tracking-tight text-ink">{me.nickname}</h2>
              {me.phoneVerified && <VerifiedMark />}
            </div>
            <p className="mt-0.5 text-[13.5px] text-muted">
              {regionLabel(me.homeRegion)} · 만 {me.age}세
            </p>
            <div className="mt-2 flex gap-4 text-[13.5px] text-ink-2">
              <span>
                팔로워 <b className="font-num text-ink">{p?.followerCount ?? '-'}</b>
              </span>
              <span>
                팔로잉 <b className="font-num text-ink">{p?.followingCount ?? '-'}</b>
              </span>
            </div>
          </div>
          <LinkButton to="/me/edit" variant="outline" size="sm">
            프로필 수정
          </LinkButton>
        </section>
        {me.bio && <p className="-mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{me.bio}</p>}

        {!me.phoneVerified && (
          <Link to="/verify" className="flex items-center gap-3 rounded-[22px] bg-warn-tint px-4 py-3.5">
            <Icon name="shield" size={22} className="text-warn-ink" />
            <span className="flex-1 text-[14.5px] text-ink">
              <b className="font-semibold">휴대폰 본인인증</b>을 하면 번개 참여·개설과 크루 만들기를 할 수 있어요
            </span>
            <Icon name="chevronRight" size={18} className="text-muted" />
          </Link>
        )}

        <Link to="/records" className="block rounded-[28px] bg-navy p-5 text-white shadow-float transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[14px] text-white/80">
            <span className="font-semibold">내 러닝 레벨</span>
            <span className="flex items-center gap-0.5">
              기록 보기 <Icon name="chevronRight" size={16} />
            </span>
          </div>
          {profile.isLoading ? (
            <Skeleton className="mt-4 h-14 bg-white/10" />
          ) : lv?.status === 'ok' ? (
            <div className="mt-3 flex items-end gap-6">
              <div>
                <div className="font-num text-[34px] font-bold leading-none">
                  {lv.sustainableDistanceKm}
                  <span className="ml-0.5 text-[15px] text-white/60">km</span>
                </div>
                <div className="mt-1.5 text-[12.5px] text-[#c9c0ff]">지속 가능 거리</div>
              </div>
              <div>
                <div className="font-num text-[34px] font-bold leading-none">{formatPace(lv.typicalPaceS)}</div>
                <div className="mt-1.5 text-[12.5px] text-[#c9c0ff]">평소 페이스</div>
              </div>
              {!lv.refreshed && <Badge className="mb-1 ml-auto bg-[#ffb547]/20 text-[#ffd18a]">갱신 필요</Badge>}
            </div>
          ) : (
            <p className="mt-3 text-[17px] font-semibold">인증 기록 {lv?.verifiedRunCount ?? 0}/3회 · 3회부터 레벨이 계산돼요</p>
          )}
        </Link>

        {p && (
          <Section title="신뢰 점수">
            <Card className="p-5">
              <TrustMeter trust={p.trust} />
              <details className="group mt-4 border-t border-line pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-ink-2">
                  점수 구성 보기
                  <Icon name="chevronDown" size={18} className="transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-2 space-y-1.5 text-[14px]">
                  {p.trust.breakdown.map((b) => (
                    <li key={b.label} className="flex justify-between">
                      <span className="text-ink-2">{b.label}</span>
                      <span className={cn('font-num font-semibold', b.points < 0 ? 'text-bad-ink' : 'text-ink')}>
                        {b.points > 0 ? '+' : ''}
                        {b.points}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                  출석률, 노쇼, 매너 후기, 본인인증, 신고 처리 결과로 계산해요. 번개 호스트는 신청자의 점수를 보고 승인을 정해요. 등급: {Object.values(TRUST_GRADE_LABELS).join(' · ')}
                </p>
              </details>
            </Card>
          </Section>
        )}

        {p && p.mannerTags.length > 0 && (
          <Section title="받은 매너 후기">
            <div className="flex flex-wrap gap-2">
              {p.mannerTags.map((t) => (
                <span key={t.tag} className="inline-flex items-center gap-1.5 rounded-full bg-mint-tint px-3 py-1.5 text-[13.5px] font-medium text-[#0d6b4c] dark:text-mint">
                  {t.tag}
                  <b className="font-num">{t.count}</b>
                </span>
              ))}
            </div>
          </Section>
        )}

        {p && p.crews.length > 0 && (
          <Section title="내 크루">
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {p.crews.map((c) => (
                <Link key={c.id} to={`/crews/${c.id}`} className="flex w-[132px] shrink-0 flex-col items-start rounded-[22px] bg-surface p-3 shadow-card">
                  <CrewEmblem crew={c} size={44} />
                  <span className="mt-2 w-full truncate text-[14px] font-semibold text-ink">{c.name}</span>
                  <span className="text-[12px] text-muted">{c.role === 'leader' ? '크루장' : c.role === 'manager' ? '운영진' : '멤버'}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Card className="divide-y divide-line overflow-hidden p-0">
          <MenuRow to="/me/activity" icon="calendar" label="내 활동" detail="번개 · 크루 · 대회" />
          <MenuRow to="/records" icon="activity" label="내 기록" />
          <MenuRow to="/verify" icon="shield" label="휴대폰 본인인증" detail={me.phoneVerified ? `인증됨 · ${me.phoneLast4 ? `****${me.phoneLast4}` : ''}` : '미인증'} />
          <MenuRow to="/notifications" icon="bell" label="알림" />
          <MenuRow to="/settings" icon="setting" label="설정" detail="공개 범위 · 알림 · 계정" />
          {me.role === 'admin' && <MenuRow to="/admin" icon="chart" label="운영 지표·신고 관리" />}
        </Card>

        <nav className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-[13px] text-muted" aria-label="약관과 안내">
          <Link to="/docs/terms">이용약관</Link>
          <Link to="/docs/privacy">개인정보 처리방침</Link>
          <Link to="/docs/location">위치기반서비스 약관</Link>
          <Link to="/docs/manners">러닝 매너</Link>
          <Link to="/docs/safety">안전 수칙</Link>
        </nav>
      </div>
    </div>
  );
}
