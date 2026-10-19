import { useMemo, useState } from 'react';
import { getPlace, matchesAnyRegion, RUNNING_PLACES, type MeetingPlace } from '@runhigh/core';
import { cn } from '../lib/cn.ts';
import { Input } from './Field.tsx';
import { Icon } from './Icon.tsx';
import { RegionSelect } from './RegionPicker.tsx';

interface Props {
  value: MeetingPlace | null;
  region: string;
  onChange: (place: MeetingPlace | null, region: string) => void;
  preferredRegions: string[];
}

/** 자주 쓰는 러닝 장소(이용 규칙 포함) 또는 직접 입력 */
export function PlacePicker({ value, region, onChange, preferredRegions }: Props) {
  const [mode, setMode] = useState<'preset' | 'custom'>(value && !value.placeId ? 'custom' : 'preset');
  const [q, setQ] = useState('');
  const places = useMemo(() => {
    const query = q.trim();
    const list = query ? RUNNING_PLACES.filter((p) => p.name.includes(query) || p.region.includes(query)) : RUNNING_PLACES;
    return [...list].sort((a, b) => Number(matchesAnyRegion(b.region, preferredRegions)) - Number(matchesAnyRegion(a.region, preferredRegions)));
  }, [q, preferredRegions]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['preset', 'custom'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              onChange(null, region);
            }}
            className={cn('h-9 rounded-full px-3.5 text-[13px] font-semibold', mode === m ? 'bg-ink text-surface' : 'border border-line bg-surface text-ink-2')}
          >
            {m === 'preset' ? '자주 가는 러닝 장소' : '직접 입력'}
          </button>
        ))}
      </div>

      {mode === 'preset' ? (
        <>
          <Input placeholder="장소 이름이나 지역으로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="no-scrollbar max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-line p-1.5" role="listbox" aria-label="러닝 장소">
            {places.map((p) => {
              const selected = value?.placeId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onChange({ placeId: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, detail: value?.detail }, p.region)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', selected ? 'bg-brand-tint' : 'hover:bg-surface-2')}
                >
                  <Icon name="location" size={18} className={selected ? 'text-brand' : 'text-muted'} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-ink">{p.name}</span>
                    <span className="block text-[12.5px] text-muted">{p.region}</span>
                  </span>
                  {p.rule && (
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', p.rule.kind === 'rule' ? 'bg-bad-tint text-bad-ink' : 'bg-warn-tint text-warn-ink')}>
                      {p.rule.kind === 'rule' ? `그룹 ${p.rule.maxGroupSize}명까지` : '단체 달리기 자제'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {value?.placeId && (
            <Input
              placeholder="모이는 정확한 지점 (예: 2번 출구 앞)"
              value={value.detail ?? ''}
              maxLength={60}
              onChange={(e) => onChange({ ...value, detail: e.target.value }, region)}
            />
          )}
        </>
      ) : (
        <div className="space-y-2.5">
          <Input placeholder="장소 이름 (예: 망원한강공원)" value={value?.name ?? ''} maxLength={40} onChange={(e) => onChange({ placeId: null, name: e.target.value, detail: value?.detail }, region)} />
          <Input placeholder="모이는 정확한 지점 (예: 망원나들목 앞)" value={value?.detail ?? ''} maxLength={60} onChange={(e) => onChange({ placeId: null, name: value?.name ?? '', detail: e.target.value }, region)} />
          <RegionSelect value={region} onChange={(r) => onChange(value, r)} />
        </div>
      )}
    </div>
  );
}

export function placeRuleOf(place: MeetingPlace | null | undefined) {
  return getPlace(place?.placeId ?? undefined)?.rule ?? null;
}

export function mapLinks(place: MeetingPlace): { kakao: string; naver: string } {
  const q = encodeURIComponent(place.name);
  return {
    kakao: place.lat && place.lng ? `https://map.kakao.com/link/map/${q},${place.lat},${place.lng}` : `https://map.kakao.com/link/search/${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
  };
}
