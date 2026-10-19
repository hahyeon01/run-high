import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { COURSE_PRESETS, type CourseKey, type MarathonCourse } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { Button, IconButton } from '../../components/Button.tsx';
import { Segmented } from '../../components/Chip.tsx';
import { Field, FormError, Input, Select, Textarea } from '../../components/Field.tsx';
import { BottomBar, Page, TopBar } from '../../components/Header.tsx';
import { Skeleton } from '../../components/Misc.tsx';
import { RegionSelect } from '../../components/RegionPicker.tsx';
import { ConfirmDialog } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { fromLocalInput, toLocalInput } from '../../lib/format.ts';

interface CourseDraft {
  key: CourseKey;
  label: string;
  distanceKm: string;
  fee: string;
  capacity: string;
}

const KEYS: CourseKey[] = ['full', 'half', '10k', '5k', 'other'];

function presetDraft(key: CourseKey): CourseDraft {
  const p = key === 'other' ? { label: '', distanceKm: 0 } : COURSE_PRESETS[key];
  return { key, label: p.label, distanceKm: p.distanceKm ? String(p.distanceKm) : '', fee: '', capacity: '' };
}

export default function RaceForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const existing = useApiQuery('races.get', { id: editId ?? '' }, { enabled: !!editId });
  const [loaded, setLoaded] = useState(!editId);

  const [name, setName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [region, setRegion] = useState('서울');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [courses, setCourses] = useState<CourseDraft[]>([presetDraft('half'), presetDraft('10k')]);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [method, setMethod] = useState<'first_come' | 'lottery'>('first_come');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [homepage, setHomepage] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const r = existing.data;
    if (!r || loaded) return;
    setName(r.name);
    setOrganizer(r.organizer);
    setRegion(r.region);
    setVenue(r.venue);
    setEventDate(r.eventDate);
    setStartTime(r.startTime ?? '');
    setCourses(r.courses.map((c) => ({ key: c.key, label: c.label, distanceKm: String(c.distanceKm), fee: c.fee != null ? String(c.fee) : '', capacity: c.capacity != null ? String(c.capacity) : '' })));
    setOpensAt(r.registrationOpensAt ? toLocalInput(r.registrationOpensAt) : '');
    setClosesAt(r.registrationClosesAt ? toLocalInput(r.registrationClosesAt) : '');
    setMethod(r.registrationMethod);
    setRegistrationUrl(r.registrationUrl ?? '');
    setHomepage(r.homepage ?? '');
    setDescription(r.description);
    setLoaded(true);
  }, [existing.data, loaded]);

  const onError = (e: { message: string }) => {
    setError(e.message);
    return true;
  };
  const create = useApiMutation('races.create', {
    onSuccess: (r) => {
      toast.success(r.notified > 0 ? `대회를 등록하고 ${r.notified}명에게 알렸어요` : '대회를 등록했어요');
      navigate(`/races/${r.id}`, { replace: true });
    },
    onError,
  });
  const update = useApiMutation('races.update', { successMessage: '대회 정보를 고쳤어요', onSuccess: () => navigate(`/races/${editId}`, { replace: true }), onError });
  const del = useApiMutation('races.delete', { successMessage: '대회를 삭제했어요', onSuccess: () => navigate('/admin?tab=races', { replace: true }) });

  const setCourse = (i: number, patch: Partial<CourseDraft>) => setCourses(courses.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const submit = () => {
    setError(null);
    if (name.trim().length < 2) return setError('대회 이름을 입력해 주세요');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return setError('대회 날짜를 골라 주세요');
    const parsed: MarathonCourse[] = [];
    for (const c of courses) {
      const d = Number(c.distanceKm);
      if (!c.label.trim() || !(d >= 1 && d <= 200)) return setError('종목 이름과 거리(1~200km)를 확인해 주세요');
      parsed.push({ key: c.key, label: c.label.trim(), distanceKm: d, fee: c.fee ? Number(c.fee) : null, capacity: c.capacity ? Number(c.capacity) : null });
    }
    if (parsed.length === 0) return setError('종목을 1개 이상 넣어 주세요');
    const body = {
      name: name.trim(),
      organizer: organizer.trim(),
      region,
      venue: venue.trim(),
      eventDate,
      startTime: startTime || null,
      courses: parsed,
      registrationOpensAt: opensAt ? fromLocalInput(opensAt) : null,
      registrationClosesAt: closesAt ? fromLocalInput(closesAt) : null,
      registrationMethod: method,
      registrationUrl: registrationUrl.trim() || null,
      homepage: homepage.trim() || null,
      description: description.trim(),
    };
    if (editId) update.mutate({ id: editId, ...body });
    else create.mutate(body);
  };

  if (editId && !loaded) {
    return (
      <div>
        <TopBar title="대회 수정" back="/admin?tab=races" />
        <Page>
          <Skeleton className="h-96" />
        </Page>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={editId ? '대회 수정' : '대회 등록'} back="/admin?tab=races" actions={editId ? <IconButton icon="delete" label="대회 삭제" onClick={() => setConfirmDelete(true)} /> : null} />
      <Page className="space-y-6">
        <Field label="대회 이름" required>{(id) => <Input id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="예: 2026 한강 가을 마라톤" />}</Field>
        <Field label="주최·주관">{(id) => <Input id={id} value={organizer} maxLength={60} onChange={(e) => setOrganizer(e.target.value)} />}</Field>
        <Field label="지역" required hint="이 지역을 러닝 가능 지역으로 정한 사용자에게 새 대회 알림이 가요">
          {(id) => <RegionSelect id={id} value={region} onChange={setRegion} allowSido />}
        </Field>
        <Field label="장소">{(id) => <Input id={id} value={venue} maxLength={80} onChange={(e) => setVenue(e.target.value)} placeholder="예: 여의도공원 문화의 마당" />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="대회 날짜" required>{(id) => <Input id={id} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />}</Field>
          <Field label="출발 시각">{(id) => <Input id={id} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}</Field>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold">종목</h2>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setCourses([...courses, presetDraft('5k')])} disabled={courses.length >= 8}>
              종목 추가
            </Button>
          </div>
          {courses.map((c, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-line p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select aria-label="종목 종류" value={c.key} onChange={(e) => setCourse(i, presetDraft(e.target.value as CourseKey))}>
                    {KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k === 'other' ? '기타' : COURSE_PRESETS[k].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <IconButton icon="close" label="종목 빼기" onClick={() => setCourses(courses.filter((_, j) => j !== i))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input aria-label="종목 이름" value={c.label} onChange={(e) => setCourse(i, { label: e.target.value })} placeholder="표시 이름" />
                <Input aria-label="거리 km" inputMode="decimal" value={c.distanceKm} onChange={(e) => setCourse(i, { distanceKm: e.target.value })} placeholder="거리 km" />
                <Input aria-label="참가비" inputMode="numeric" value={c.fee} onChange={(e) => setCourse(i, { fee: e.target.value.replace(/[^0-9]/g, '') })} placeholder="참가비 (원)" />
                <Input aria-label="정원" inputMode="numeric" value={c.capacity} onChange={(e) => setCourse(i, { capacity: e.target.value.replace(/[^0-9]/g, '') })} placeholder="정원 (명)" />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-[15px] font-semibold">접수</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="접수 시작" hint="알림 켠 사용자에게 하루 전·10분 전·오픈 시각에 알림">{(id) => <Input id={id} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />}</Field>
            <Field label="접수 마감">{(id) => <Input id={id} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />}</Field>
          </div>
          <Segmented
            value={method}
            onChange={setMethod}
            options={[
              { value: 'first_come', label: '선착순' },
              { value: 'lottery', label: '추첨' },
            ]}
          />
          <Field label="접수 페이지 주소">{(id) => <Input id={id} type="url" value={registrationUrl} onChange={(e) => setRegistrationUrl(e.target.value)} placeholder="https://" />}</Field>
          <Field label="공식 홈페이지">{(id) => <Input id={id} type="url" value={homepage} onChange={(e) => setHomepage(e.target.value)} placeholder="https://" />}</Field>
        </section>

        <Field label="대회 소개">{(id) => <Textarea id={id} rows={5} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="코스 특징, 기념품, 교통 통제, 물품 보관 등" />}</Field>
        <FormError message={error} />
      </Page>
      <BottomBar>
        <Button size="lg" block loading={create.isPending || update.isPending} onClick={submit}>
          {editId ? '저장' : '등록하고 알리기'}
        </Button>
      </BottomBar>
      <ConfirmDialog
        open={confirmDelete}
        title="대회를 삭제할까요?"
        description="메이트 모집글과 관심 등록도 함께 지워져요."
        confirmLabel="삭제"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => editId && del.mutate({ id: editId })}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
