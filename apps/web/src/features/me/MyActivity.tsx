import { useSearchParams } from 'react-router';
import type { FlashRunListItem } from '@runhigh/core';
import { useApiQuery } from '../../api/hooks.ts';
import { LinkButton } from '../../components/Button.tsx';
import { Section } from '../../components/Card.tsx';
import { Page, TopBar } from '../../components/Header.tsx';
import { EmptyState, ErrorState, ListSkeleton, Tabs } from '../../components/Misc.tsx';
import { CrewRow } from '../crews/parts.tsx';
import { FlashRow } from '../flash/FlashCards.tsx';
import { RaceRow } from '../races/parts.tsx';

type Tab = 'flash' | 'crews' | 'races';

function FlashSection({ title, items, empty }: { title: string; items: FlashRunListItem[]; empty: string }) {
  return (
    <Section title={`${title} ${items.length}`}>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-4 text-[14px] text-muted">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <FlashRow key={i.id} item={i} />
          ))}
        </div>
      )}
    </Section>
  );
}

export default function MyActivity() {
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  const tab: Tab = t === 'crews' || t === 'races' ? t : 'flash';
  const flash = useApiQuery('flash.mine', {}, { enabled: tab === 'flash' });
  const crews = useApiQuery('crews.list', { mine: true }, { enabled: tab === 'crews' });
  const races = useApiQuery('races.list', { followed: true, status: 'all' }, { enabled: tab === 'races' });

  return (
    <div>
      <TopBar title="내 활동" back="/me" />
      <Page className="space-y-6">
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'flash' ? {} : { tab: v }, { replace: true })}
          tabs={[
            { value: 'flash', label: '번개' },
            { value: 'crews', label: '크루' },
            { value: 'races', label: '관심 대회' },
          ]}
        />

        {tab === 'flash' &&
          (flash.isLoading ? (
            <ListSkeleton />
          ) : flash.error || !flash.data ? (
            <ErrorState message={flash.error?.message ?? '불러오지 못했어요'} onRetry={() => void flash.refetch()} />
          ) : (
            <div className="space-y-8">
              <FlashSection title="내가 연 번개" items={flash.data.hosting} empty="예정된 번개가 없어요." />
              <FlashSection title="참여 예정" items={flash.data.joined} empty="참여 신청한 번개가 없어요." />
              <FlashSection title="지난 번개" items={flash.data.past} empty="아직 함께 달린 번개가 없어요." />
              <LinkButton to="/flash/new" variant="secondary" block icon="bolt">
                번개 열기
              </LinkButton>
            </div>
          ))}

        {tab === 'crews' &&
          (crews.isLoading ? (
            <ListSkeleton />
          ) : (crews.data ?? []).length === 0 ? (
            <EmptyState icon="people" title="가입한 크루가 없어요" action={<LinkButton to="/crews">크루 둘러보기</LinkButton>} />
          ) : (
            <div className="space-y-3">
              {crews.data!.map((c) => (
                <CrewRow key={c.id} crew={c} />
              ))}
            </div>
          ))}

        {tab === 'races' &&
          (races.isLoading ? (
            <ListSkeleton />
          ) : (races.data ?? []).length === 0 ? (
            <EmptyState icon="ticket" title="관심 대회가 없어요" description="대회 화면에서 알림을 켜거나 참가 계획을 정하면 여기에 모여요." action={<LinkButton to="/races">대회 보기</LinkButton>} />
          ) : (
            <div className="space-y-3">
              {races.data!.map((r, i) => (
                <RaceRow key={r.id} race={r} index={i} />
              ))}
            </div>
          ))}
      </Page>
    </div>
  );
}
