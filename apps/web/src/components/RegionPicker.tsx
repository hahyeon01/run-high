import { useMemo, useState } from 'react';
import { regionLabel, regionSido, SIDO_LIST } from '@runhigh/core';
import { cn } from '../lib/cn.ts';
import { Icon } from './Icon.tsx';
import { Select } from './Field.tsx';

/** 시·도 → 시·군·구 단일 선택 */
export function RegionSelect({ value, onChange, allowSido = false, id }: { value: string; onChange: (v: string) => void; allowSido?: boolean; id?: string }) {
  const sido = value ? regionSido(value) : '';
  const entry = SIDO_LIST.find((s) => s.short === sido);
  const sub = value.includes(' ') ? value.split(' ').slice(1).join(' ') : '';
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        id={id}
        aria-label="시·도"
        value={sido}
        onChange={(e) => {
          const s = SIDO_LIST.find((x) => x.short === e.target.value);
          if (!s) return onChange('');
          onChange(s.sigungu.length === 0 || allowSido ? s.short : `${s.short} ${s.sigungu[0]}`);
        }}
      >
        <option value="">시·도 선택</option>
        {SIDO_LIST.map((s) => (
          <option key={s.short} value={s.short}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="시·군·구"
        value={sub}
        disabled={!entry || entry.sigungu.length === 0}
        onChange={(e) => onChange(e.target.value ? `${sido} ${e.target.value}` : sido)}
      >
        {(allowSido || !entry || entry.sigungu.length === 0) && <option value="">{entry ? `${entry.short} 전체` : '시·군·구'}</option>}
        {entry?.sigungu.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** 러닝 가능 지역 여러 개 선택 (최대 5곳) */
export function RegionMultiPicker({ value, onChange, max = 5 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [draft, setDraft] = useState('');
  const canAdd = draft && !value.includes(draft) && value.length < max;
  const sorted = useMemo(() => value, [value]);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {sorted.map((r) => (
          <span key={r} className="inline-flex h-9 items-center gap-1 rounded-full bg-brand-tint pl-3.5 pr-1.5 text-[13px] font-semibold text-brand-strong">
            {regionLabel(r)}
            <button type="button" aria-label={`${regionLabel(r)} 빼기`} onClick={() => onChange(value.filter((v) => v !== r))} className="inline-flex size-6 items-center justify-center rounded-full hover:bg-brand-tint-2">
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="text-[13px] text-muted">아직 선택한 지역이 없어요</span>}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <RegionSelect value={draft} onChange={setDraft} allowSido />
        </div>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) return;
            onChange([...value, draft]);
            setDraft('');
          }}
          className={cn('h-12 shrink-0 rounded-2xl px-4 text-[14px] font-semibold', canAdd ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted')}
        >
          추가
        </button>
      </div>
      <p className="text-[12.5px] text-muted">
        시·도 전체(예: 서울 전체)도 고를 수 있어요. 최대 {max}곳 · 이 지역의 새 대회와 번개를 알려드려요
      </p>
    </div>
  );
}
