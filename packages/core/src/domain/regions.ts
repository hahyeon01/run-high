/**
 * 행정구역 데이터 (시·도 / 시·군·구)
 *
 * 지역 키 형식
 *  - 시·도 전체: "서울"
 *  - 시·군·구:  "서울 서초구"
 *
 * 인천은 2026년 7월 행정체제 개편(제물포구·영종구·검단구 신설)을 반영했습니다.
 * 행정구역이 바뀌면 이 파일만 수정하면 됩니다.
 */

export interface Sido {
  short: string;
  name: string;
  sigungu: string[];
}

export const SIDO_LIST: Sido[] = [
  {
    short: '서울',
    name: '서울특별시',
    sigungu: [
      '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구',
      '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구',
      '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
    ],
  },
  {
    short: '부산',
    name: '부산광역시',
    sigungu: [
      '강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구', '사상구',
      '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구',
    ],
  },
  {
    short: '대구',
    name: '대구광역시',
    sigungu: ['군위군', '남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구'],
  },
  {
    short: '인천',
    name: '인천광역시',
    sigungu: ['강화군', '검단구', '계양구', '남동구', '미추홀구', '부평구', '서구', '연수구', '영종구', '옹진군', '제물포구'],
  },
  { short: '광주', name: '광주광역시', sigungu: ['광산구', '남구', '동구', '북구', '서구'] },
  { short: '대전', name: '대전광역시', sigungu: ['대덕구', '동구', '서구', '유성구', '중구'] },
  { short: '울산', name: '울산광역시', sigungu: ['남구', '동구', '북구', '울주군', '중구'] },
  { short: '세종', name: '세종특별자치시', sigungu: [] },
  {
    short: '경기',
    name: '경기도',
    sigungu: [
      '가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시', '남양주시',
      '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시', '안양시', '양주시',
      '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시',
      '평택시', '포천시', '하남시', '화성시',
    ],
  },
  {
    short: '강원',
    name: '강원특별자치도',
    sigungu: [
      '강릉시', '고성군', '동해시', '삼척시', '속초시', '양구군', '양양군', '영월군', '원주시',
      '인제군', '정선군', '철원군', '춘천시', '태백시', '평창군', '홍천군', '화천군', '횡성군',
    ],
  },
  {
    short: '충북',
    name: '충청북도',
    sigungu: ['괴산군', '단양군', '보은군', '영동군', '옥천군', '음성군', '제천시', '증평군', '진천군', '청주시', '충주시'],
  },
  {
    short: '충남',
    name: '충청남도',
    sigungu: [
      '계룡시', '공주시', '금산군', '논산시', '당진시', '보령시', '부여군', '서산시', '서천군',
      '아산시', '예산군', '천안시', '청양군', '태안군', '홍성군',
    ],
  },
  {
    short: '전북',
    name: '전북특별자치도',
    sigungu: [
      '고창군', '군산시', '김제시', '남원시', '무주군', '부안군', '순창군', '완주군', '익산시',
      '임실군', '장수군', '전주시', '정읍시', '진안군',
    ],
  },
  {
    short: '전남',
    name: '전라남도',
    sigungu: [
      '강진군', '고흥군', '곡성군', '광양시', '구례군', '나주시', '담양군', '목포시', '무안군',
      '보성군', '순천시', '신안군', '여수시', '영광군', '영암군', '완도군', '장성군', '장흥군',
      '진도군', '함평군', '해남군', '화순군',
    ],
  },
  {
    short: '경북',
    name: '경상북도',
    sigungu: [
      '경산시', '경주시', '고령군', '구미시', '김천시', '문경시', '봉화군', '상주시', '성주군',
      '안동시', '영덕군', '영양군', '영주시', '영천시', '예천군', '울릉군', '울진군', '의성군',
      '청도군', '청송군', '칠곡군', '포항시',
    ],
  },
  {
    short: '경남',
    name: '경상남도',
    sigungu: [
      '거제시', '거창군', '고성군', '김해시', '남해군', '밀양시', '사천시', '산청군', '양산시',
      '의령군', '진주시', '창녕군', '창원시', '통영시', '하동군', '함안군', '함양군', '합천군',
    ],
  },
  { short: '제주', name: '제주특별자치도', sigungu: ['서귀포시', '제주시'] },
];

const SIDO_BY_SHORT = new Map(SIDO_LIST.map((s) => [s.short, s]));

/** 모든 유효한 지역 키 (시·도 전체 포함) */
export const ALL_REGION_KEYS: string[] = SIDO_LIST.flatMap((s) => [
  s.short,
  ...s.sigungu.map((g) => `${s.short} ${g}`),
]);

const REGION_KEY_SET = new Set(ALL_REGION_KEYS);

export function isValidRegion(key: string): boolean {
  return REGION_KEY_SET.has(key);
}

/** "서울 서초구" → "서울" */
export function regionSido(key: string): string {
  return key.split(' ')[0] ?? key;
}

/** 시·도 전체 키인지 ("서울") */
export function isSidoKey(key: string): boolean {
  return !key.includes(' ');
}

/** 화면 표시용: "서울" → "서울 전체", "서울 서초구" → "서울 서초구" */
export function regionLabel(key: string): string {
  if (!key) return '';
  if (isSidoKey(key)) return key === '세종' ? '세종' : `${key} 전체`;
  return key;
}

/** 짧은 표시용: "서울 서초구" → "서초구", "서울" → "서울" */
export function regionShortLabel(key: string): string {
  if (isSidoKey(key)) return key;
  return key.split(' ').slice(1).join(' ');
}

export function sidoFullName(short: string): string {
  return SIDO_BY_SHORT.get(short)?.name ?? short;
}

/**
 * 두 지역이 겹치는지 판단합니다.
 * - 같은 키면 겹침
 * - 한쪽이 시·도 전체이고 다른 쪽이 그 시·도의 하위 지역이면 겹침
 */
export function regionsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (isSidoKey(a)) return regionSido(b) === a;
  if (isSidoKey(b)) return regionSido(a) === b;
  return false;
}

/** target 지역이 list 중 하나와 겹치는지 */
export function matchesAnyRegion(target: string, list: readonly string[]): boolean {
  return list.some((r) => regionsOverlap(target, r));
}
