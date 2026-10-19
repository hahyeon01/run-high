/** 데모 계정 (모든 계정 비밀번호: runhigh123!) */
export const DEMO_PASSWORD = 'runhigh123!';

export interface DemoAccount {
  email: string;
  nickname: string;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo@runhigh.app',
    nickname: '한강러너',
    description: '기본 데모 계정 · 10km 5\'50"대 · 마포 새벽런 멤버 · 번개 호스트',
  },
  {
    email: 'pacer@runhigh.app',
    nickname: '페이스메이커J',
    description: '상급 러너 · 반포 번개 호스트 · 반포 서브4 클럽 크루장',
  },
  {
    email: 'squirrel@runhigh.app',
    nickname: '달리는다람쥐',
    description: '중급 · 여성 전용 번개 호스트 · 송파 런앤브런치 크루장',
  },
  {
    email: 'minji@runhigh.app',
    nickname: '초보러너민지',
    description: '입문 러너 · 승인 대기 중인 번개 신청이 있어요',
  },
  {
    email: 'dawn@runhigh.app',
    nickname: '새벽런',
    description: '마포 새벽런 크루장 · 가입 신청 승인, 출석·회비 관리',
  },
  {
    email: 'teen@runhigh.app',
    nickname: '청춘러너',
    description: '만 17세 청소년 · 참여 제한 확인용',
  },
  {
    email: 'noshow@runhigh.app',
    nickname: '노쇼왕',
    description: '노쇼 이력 2회 · 신뢰 점수 "주의"',
  },
  {
    email: 'admin@runhigh.app',
    nickname: '런하이운영자',
    description: '운영자 · 운영 지표, 신고 처리, 대회 등록',
  },
];
