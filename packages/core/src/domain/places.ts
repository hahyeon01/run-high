/**
 * 자주 쓰는 러닝 집결지와 장소별 이용 규칙
 *
 * 단체 달리기 제한은 전국 공통 법규가 아니라 각 운동장·공원이 정한 이용 규칙이나 권고입니다.
 * 그래서 장소마다 따로 관리하고, 번개를 만들 때 해당 장소의 규칙을 보여주고 인원을 제한합니다.
 *  - kind 'rule'     : 시설 이용 규칙 (인원 상한을 앱에서 강제)
 *  - kind 'advisory' : 지자체 권고·안내문 (경고 표시 + 한 줄 달리기 서약)
 */

export type PlaceSurface = 'track' | 'park' | 'riverside' | 'road' | 'trail';

export interface PlaceRule {
  kind: 'rule' | 'advisory';
  /** 한 그룹(페이스 조)에서 함께 달릴 수 있는 최대 인원 (호스트·페이서 포함) */
  maxGroupSize?: number;
  /** 러너 간 권장 간격 (m) */
  spacingM?: number;
  advisories: string[];
  source: string;
}

export interface RunningPlace {
  id: string;
  name: string;
  region: string;
  address: string;
  lat: number;
  lng: number;
  surface: PlaceSurface;
  rule?: PlaceRule;
}

export interface MeetingPlace {
  /** 프리셋 장소 id (직접 입력이면 없음) */
  placeId?: string | null;
  name: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  /** 집결 지점 상세 (예: 2번 출구 앞 광장) */
  detail?: string;
}

export const RUNNING_PLACES: RunningPlace[] = [
  {
    id: 'banpo-stadium',
    name: '반포종합운동장',
    region: '서울 서초구',
    address: '서울 서초구 반포동',
    lat: 37.5016,
    lng: 126.9989,
    surface: 'track',
    rule: {
      kind: 'rule',
      maxGroupSize: 4,
      spacingM: 2,
      advisories: ['트랙 내 5인 이상 단체 달리기 제한', '러너 간 2m 이상 간격 유지', '트랙에서 단체 사진 촬영 자제'],
      source: '서초구 반포종합운동장 이용 규칙',
    },
  },
  {
    id: 'banpo-hangang',
    name: '반포한강공원',
    region: '서울 서초구',
    address: '서울 서초구 신반포로11길 40',
    lat: 37.5103,
    lng: 126.9958,
    surface: 'riverside',
  },
  {
    id: 'seokchon-lake',
    name: '석촌호수',
    region: '서울 송파구',
    address: '서울 송파구 잠실동',
    lat: 37.5087,
    lng: 127.1025,
    surface: 'park',
    rule: {
      kind: 'advisory',
      maxGroupSize: 2,
      advisories: ['3인 이상 무리 지어 달리기 자제', '산책로에서는 한 줄로 달리기'],
      source: '송파구 안내 현수막',
    },
  },
  {
    id: 'seoul-forest',
    name: '서울숲',
    region: '서울 성동구',
    address: '서울 성동구 뚝섬로 273',
    lat: 37.5444,
    lng: 127.0374,
    surface: 'park',
    rule: {
      kind: 'advisory',
      advisories: ['단체 달리기 자제', '보행자 우선, 한 줄 달리기'],
      source: '성동구 안내 현수막',
    },
  },
  {
    id: 'yeouido-park',
    name: '여의도공원',
    region: '서울 영등포구',
    address: '서울 영등포구 여의공원로 68',
    lat: 37.5257,
    lng: 126.9224,
    surface: 'park',
    rule: {
      kind: 'advisory',
      advisories: ['무리 지어 달리기 자제', '박수·함성 자제', '"비켜요" 외치지 않기', '웃옷 벗고 달리기 자제'],
      source: '여의도공원 안내문',
    },
  },
  {
    id: 'yeouido-hangang',
    name: '여의도한강공원',
    region: '서울 영등포구',
    address: '서울 영등포구 여의동로 330',
    lat: 37.5284,
    lng: 126.9326,
    surface: 'riverside',
  },
  {
    id: 'ttukseom-hangang',
    name: '뚝섬한강공원',
    region: '서울 광진구',
    address: '서울 광진구 강변북로 139',
    lat: 37.5296,
    lng: 127.0699,
    surface: 'riverside',
  },
  {
    id: 'olympic-park',
    name: '올림픽공원',
    region: '서울 송파구',
    address: '서울 송파구 올림픽로 424',
    lat: 37.5206,
    lng: 127.1215,
    surface: 'park',
  },
  {
    id: 'namsan-north',
    name: '남산 북측순환로',
    region: '서울 중구',
    address: '서울 중구 남산공원길',
    lat: 37.5547,
    lng: 126.9877,
    surface: 'road',
    rule: {
      kind: 'advisory',
      advisories: ['보행자 우선 도로, 추월 시 속도 줄이기', '좁은 구간은 한 줄로 달리기'],
      source: '남산공원 이용 안내',
    },
  },
  {
    id: 'seongbukcheon',
    name: '성북천',
    region: '서울 성북구',
    address: '서울 성북구 성북천 산책로',
    lat: 37.5893,
    lng: 127.0166,
    surface: 'riverside',
    rule: {
      kind: 'advisory',
      advisories: ['우측 통행', '한 줄로 달리기'],
      source: '성북구 안내 현수막·안내 방송',
    },
  },
  {
    id: 'yangjaecheon',
    name: '양재천',
    region: '서울 강남구',
    address: '서울 강남구 양재천 산책로',
    lat: 37.4842,
    lng: 127.0461,
    surface: 'riverside',
  },
  {
    id: 'bulgwangcheon',
    name: '불광천',
    region: '서울 은평구',
    address: '서울 은평구 불광천 산책로',
    lat: 37.5855,
    lng: 126.9124,
    surface: 'riverside',
  },
  {
    id: 'dongtan-lake',
    name: '동탄호수공원',
    region: '경기 화성시',
    address: '경기 화성시 동탄호수공원',
    lat: 37.1897,
    lng: 127.1037,
    surface: 'park',
    rule: {
      kind: 'advisory',
      advisories: ['러닝크루 단체 출입 자제 권고', '산책로에서는 한 줄로 달리기'],
      source: '화성시 권고',
    },
  },
  {
    id: 'gwanggyo-lake',
    name: '광교호수공원',
    region: '경기 수원시',
    address: '경기 수원시 영통구 광교호수로',
    lat: 37.2834,
    lng: 127.0656,
    surface: 'park',
  },
  {
    id: 'ilsan-lake',
    name: '일산호수공원',
    region: '경기 고양시',
    address: '경기 고양시 일산동구 호수로 595',
    lat: 37.6583,
    lng: 126.7672,
    surface: 'park',
  },
  {
    id: 'songdo-central',
    name: '송도 센트럴파크',
    region: '인천 연수구',
    address: '인천 연수구 컨벤시아대로 160',
    lat: 37.3925,
    lng: 126.6386,
    surface: 'park',
  },
  {
    id: 'gwangalli',
    name: '광안리 해변',
    region: '부산 수영구',
    address: '부산 수영구 광안해변로',
    lat: 35.1532,
    lng: 129.1186,
    surface: 'road',
  },
  {
    id: 'apec-naru',
    name: 'APEC나루공원',
    region: '부산 해운대구',
    address: '부산 해운대구 우동',
    lat: 35.1686,
    lng: 129.1306,
    surface: 'riverside',
  },
  {
    id: 'suseong-lake',
    name: '수성못',
    region: '대구 수성구',
    address: '대구 수성구 두산동',
    lat: 35.8277,
    lng: 128.6177,
    surface: 'park',
  },
  {
    id: 'gapcheon',
    name: '갑천 엑스포다리',
    region: '대전 유성구',
    address: '대전 유성구 도룡동',
    lat: 36.3741,
    lng: 127.3879,
    surface: 'riverside',
  },
  {
    id: 'pungam-lake',
    name: '풍암호수공원',
    region: '광주 서구',
    address: '광주 서구 풍암동',
    lat: 35.1219,
    lng: 126.8786,
    surface: 'park',
  },
  {
    id: 'taehwa-garden',
    name: '태화강국가정원',
    region: '울산 중구',
    address: '울산 중구 태화동',
    lat: 35.5490,
    lng: 129.3015,
    surface: 'riverside',
  },
  {
    id: 'sejong-lake',
    name: '세종호수공원',
    region: '세종',
    address: '세종 연기면 세종리',
    lat: 36.4983,
    lng: 127.2717,
    surface: 'park',
  },
  {
    id: 'gongjicheon',
    name: '공지천',
    region: '강원 춘천시',
    address: '강원 춘천시 공지천',
    lat: 37.8695,
    lng: 127.7154,
    surface: 'riverside',
  },
  {
    id: 'jeonju-samcheon',
    name: '삼천 산책로',
    region: '전북 전주시',
    address: '전북 전주시 완산구 삼천동',
    lat: 35.8063,
    lng: 127.1173,
    surface: 'riverside',
  },
  {
    id: 'jeju-tapdong',
    name: '탑동 해안도로',
    region: '제주 제주시',
    address: '제주 제주시 탑동로',
    lat: 33.5167,
    lng: 126.5237,
    surface: 'road',
  },
];

const PLACE_BY_ID = new Map(RUNNING_PLACES.map((p) => [p.id, p]));

export function getPlace(id: string | null | undefined): RunningPlace | undefined {
  return id ? PLACE_BY_ID.get(id) : undefined;
}

/** 모든 번개·크루 일정에 공통으로 적용하는 러닝 매너 */
export const MANNER_GUIDE: string[] = [
  '산책로에서는 한 줄로, 우측으로 달려요',
  '"비켜요"라고 외치지 않고 속도를 줄여 지나가요',
  '출발·도착 집결과 단체 사진은 통행에 방해되지 않는 넓은 곳에서',
  '스피커로 음악을 틀지 않아요',
  '웃옷을 벗고 달리지 않아요',
  '물병·쓰레기는 되가져가요',
  '보행자, 반려견, 어린이가 있으면 먼저 양보해요',
];

/** 안전 수칙 */
export const SAFETY_GUIDE: string[] = [
  '집결지는 사람이 많은 공공장소로 정해요',
  '처음 만나는 사람에게 연락처·집 주소를 바로 알려주지 않아요',
  '번개 화면에서 지인에게 내 현재 위치를 보낼 수 있어요',
  '몸이 불편하면 무리하지 말고 페이서에게 알리고 멈춰요',
  '부상·사고가 나면 119에 먼저 연락해요',
];

/** 장소 규칙을 반영한 그룹당 최대 인원 (규칙이 없으면 기본 상한) */
export const DEFAULT_MAX_GROUP_SIZE = 6;
export const HARD_MAX_GROUP_SIZE = 10;

export function maxGroupSizeFor(place: MeetingPlace | null | undefined): { max: number; enforced: boolean; rule?: PlaceRule } {
  const preset = getPlace(place?.placeId ?? undefined);
  const rule = preset?.rule;
  if (rule?.kind === 'rule' && rule.maxGroupSize) {
    return { max: rule.maxGroupSize, enforced: true, rule };
  }
  return { max: DEFAULT_MAX_GROUP_SIZE, enforced: false, rule };
}
