import type { Privacy } from '@runhigh/core';
import { Segmented } from './Chip.tsx';
import { Field } from './Field.tsx';

/** 공개 범위 설정 (가입 단계와 설정 화면에서 함께 사용) */
export function PrivacyEditor({ value, onChange }: { value: Privacy; onChange: (p: Privacy) => void }) {
  return (
    <div className="space-y-5">
      <Field label="나이" hint="참여 조건 확인에는 실제 나이를 쓰고, 다른 사람에게는 고른 방식대로 보여요">
        {() => (
          <Segmented
            size="sm"
            value={value.age}
            onChange={(age) => onChange({ ...value, age })}
            options={[
              { value: 'decade', label: '연령대 (30대)' },
              { value: 'exact', label: '나이 (34세)' },
              { value: 'hidden', label: '숨김' },
            ]}
          />
        )}
      </Field>
      <Field label="성별">
        {() => <Segmented size="sm" value={value.gender} onChange={(gender) => onChange({ ...value, gender })} options={[{ value: 'public', label: '공개' }, { value: 'hidden', label: '숨김' }]} />}
      </Field>
      <Field label="기록 통계 (지속 가능 거리·페이스)" hint={value.stats === 'on_apply' ? '번개·크루에 신청할 때 동의하면 호스트·운영진에게만 보여요' : value.stats === 'private' ? '호스트에게는 판정 결과(바로 참여/도전/무리)만 전달돼요' : '프로필을 보는 누구나 볼 수 있어요'}>
        {() => (
          <Segmented
            size="sm"
            value={value.stats}
            onChange={(stats) => onChange({ ...value, stats })}
            options={[
              { value: 'on_apply', label: '신청할 때만' },
              { value: 'public', label: '전체 공개' },
              { value: 'private', label: '비공개' },
            ]}
          />
        )}
      </Field>
      <Field label="기록 목록">
        {() => (
          <Segmented
            size="sm"
            value={value.records}
            onChange={(records) => onChange({ ...value, records })}
            options={[
              { value: 'followers', label: '팔로워' },
              { value: 'public', label: '전체 공개' },
              { value: 'private', label: '나만 보기' },
            ]}
          />
        )}
      </Field>
    </div>
  );
}
