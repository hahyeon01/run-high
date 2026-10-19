import { Link, useParams } from 'react-router';
import { MANNER_GUIDE, MIN_SIGNUP_AGE, SAFETY_GUIDE } from '@runhigh/core';
import { Page, TopBar } from '../../components/Header.tsx';
import { Callout } from '../../components/Misc.tsx';

interface Doc {
  title: string;
  draft?: boolean;
  sections: { heading: string; items: string[] }[];
}

export const DOCS: Record<string, Doc> = {
  terms: {
    title: '이용약관',
    draft: true,
    sections: [
      {
        heading: '서비스',
        items: [
          '런하이는 러너가 인증된 러닝 기록을 바탕으로 번개(그룹런), 크루, 대회 정보와 메이트를 찾도록 돕는 커뮤니티 서비스예요.',
          '번개와 크루 일정은 회원이 직접 열고 운영해요. 런하이는 만남을 중개하는 공간을 제공할 뿐, 모임을 주최하지 않아요.',
        ],
      },
      {
        heading: '가입과 계정',
        items: [
          `만 ${MIN_SIGNUP_AGE}세 이상 가입할 수 있어요. 만 19세 미만은 '청소년 참여 가능'으로 열린 번개에만 참여할 수 있고 번개를 열 수 없어요.`,
          '번개 참여·개설, 크루 만들기, 메이트 모집에는 휴대폰 본인인증이 필요해요. 번호 하나로 한 계정만 인증할 수 있어요.',
          '계정 정보는 본인만 써야 하고, 다른 사람에게 빌려주거나 팔 수 없어요.',
        ],
      },
      {
        heading: '기록과 판정',
        items: [
          '레벨과 번개 자격 판정에는 GPS 측정, GPX·TCX 파일, 헬스 커넥트에서 가져온 인증 기록만 써요. 직접 입력한 기록은 참고용이에요.',
          '기록을 조작하거나 다른 사람의 기록을 올리면 이용이 제한될 수 있어요.',
          '판정 결과는 최근 기록을 바탕으로 한 참고 정보예요. 실제 컨디션과 안전은 각자 판단해 주세요.',
        ],
      },
      {
        heading: '금지 행동',
        items: [
          '배번(대회 참가권)의 양도·판매·구매 글. 대부분의 대회 규정상 금지되어 있어요.',
          '러닝과 무관한 만남을 목적으로 한 연락, 괴롭힘, 욕설, 차별, 스팸·광고.',
          '번개에 신청하고 알리지 않고 나오지 않는 행동(노쇼)이 반복되면 신뢰 점수가 내려가고 참여가 제한될 수 있어요.',
        ],
      },
      {
        heading: '신고와 제재',
        items: [
          '같은 콘텐츠에 서로 다른 회원의 신고가 3건 이상 모이면 운영자 확인 전까지 자동으로 숨겨져요.',
          '운영자는 신고를 확인해 콘텐츠를 숨기거나 계정을 정지할 수 있고, 처리 결과를 신고자에게 알려요.',
          '노쇼 기록이 잘못되었다면 해당 번개에서 이의를 제기할 수 있어요.',
        ],
      },
      {
        heading: '책임',
        items: [
          '러닝 중 부상·사고는 각자 책임이에요. 모임 전 몸 상태를 확인하고, 사고가 나면 119에 먼저 연락해 주세요.',
          '회원 간 금전 거래(크루 회비 등)는 런하이가 대신 받거나 보증하지 않아요.',
        ],
      },
    ],
  },
  privacy: {
    title: '개인정보 처리방침',
    draft: true,
    sections: [
      {
        heading: '수집하는 정보',
        items: [
          '필수: 이메일, 비밀번호(암호화), 닉네임, 생년월일, 성별, 거주 지역, 러닝 가능 지역',
          '본인인증: 휴대폰 번호는 일방향 암호화(해시)와 끝 4자리만 저장해요',
          '러닝 기록: 날짜, 거리, 시간, 페이스, 경로(위도·경도), 기록 출처',
          '선택: 프로필 소개, 사진, 직접 입력한 최대 거리·페이스',
        ],
      },
      {
        heading: '이용 목적',
        items: [
          '레벨 계산과 번개·크루·메이트 자격 판정, 지역 맞춤 번개·대회 알림',
          '번개 참여 관리(출석, 노쇼, 매너 후기)와 신뢰 점수 계산',
          '신고 처리와 부정 이용 방지',
        ],
      },
      {
        heading: '공개 범위',
        items: [
          '나이·성별·기록 통계·기록 목록의 공개 범위는 설정에서 직접 정해요.',
          '기록 통계는 기본적으로 번개·크루에 신청할 때 동의한 경우에만 호스트·운영진에게 보여요.',
          '휴대폰 번호와 생년월일은 다른 회원에게 보이지 않아요.',
        ],
      },
      {
        heading: '보관과 파기',
        items: [
          '탈퇴하면 이메일·닉네임·연락처 정보를 지우고, 함께한 번개·후기 기록은 다른 회원의 이력 보존을 위해 ‘탈퇴한 러너’로 남겨요.',
          '휴대폰 인증 요청 기록은 만료 후 하루 안에 지워요. 알림은 120일이 지나면 지워요.',
        ],
      },
      {
        heading: '처리 위탁',
        items: ['서버 운영(호스팅), 문자 발송(본인인증) 업체에 필요한 범위에서만 맡겨요. 실제 서비스 시작 전 업체명을 이곳에 알려 드려요.'],
      },
      {
        heading: '권리',
        items: ['내 정보를 언제든 확인·수정할 수 있고, 설정에서 탈퇴할 수 있어요. 개인정보 문의는 운영자 연락처로 보내 주세요.'],
      },
    ],
  },
  location: {
    title: '위치기반서비스 이용약관',
    draft: true,
    sections: [
      {
        heading: '위치 정보 이용',
        items: [
          'GPS 측정 중에만 위치를 받아 달린 거리·페이스·경로를 계산해요.',
          '번개 화면에서 참여자가 직접 누른 경우에만 현재 위치를 지도 링크로 만들어 지인에게 보낼 수 있어요. 이 위치는 런하이 서버에 저장하지 않아요.',
          '집결지 근처 번개 추천에는 기기 위치 대신 회원이 고른 러닝 가능 지역을 써요.',
        ],
      },
      {
        heading: '보관',
        items: ['저장한 러닝 기록의 경로만 보관하고, 측정이 끝나면 실시간 위치는 보관하지 않아요. 기록을 지우면 경로도 함께 지워져요.'],
      },
      {
        heading: '동의 철회',
        items: ['기기 설정에서 위치 권한을 끄면 GPS 측정만 쓸 수 없고, 파일 가져오기와 헬스 커넥트는 그대로 쓸 수 있어요.'],
      },
    ],
  },
  health: {
    title: '운동 기록 처리 안내',
    draft: true,
    sections: [
      {
        heading: '읽는 정보',
        items: [
          '헬스 커넥트(Android)에서는 러닝 운동 세션의 시작·끝 시각, 거리, 경로만 읽어요. 심박수·체중 등 다른 건강 정보는 읽지 않아요.',
          'GPX·TCX 파일에서는 시각이 있는 GPS 지점과 랩 거리·시간을 읽어요.',
        ],
      },
      {
        heading: '쓰는 곳',
        items: ['최근 8주 레벨(지속 가능 거리·평소 페이스·예상 페이스) 계산과 번개 자격 판정에만 써요.'],
      },
      {
        heading: '관리',
        items: ['가져온 기록은 언제든 지울 수 있고, 헬스 커넥트 권한은 헬스 커넥트 앱에서 끌 수 있어요.'],
      },
    ],
  },
  manners: {
    title: '러닝 매너',
    sections: [
      { heading: '함께 달릴 때', items: MANNER_GUIDE },
      {
        heading: '번개 약속',
        items: [
          '못 가게 되면 최소 2시간 전에 참여를 취소해 주세요. 알리지 않고 나오지 않으면 노쇼로 기록돼요.',
          '호스트는 출석과 완주를 정확히 기록하고, 참여자는 서로 매너 후기를 남겨요.',
          '장소마다 정한 단체 달리기 인원 제한(예: 그룹당 4명)을 지켜요.',
        ],
      },
    ],
  },
  safety: {
    title: '안전 수칙',
    sections: [
      { heading: '만나기 전', items: SAFETY_GUIDE },
      {
        heading: '불편한 일이 생기면',
        items: ['번개·게시글·사용자 화면의 더보기 메뉴에서 신고하고 차단할 수 있어요. 차단하면 서로의 글과 번개가 보이지 않아요.'],
      },
    ],
  },
};

/** 문서 본문 (페이지와 가입 화면의 시트에서 함께 사용) */
export function DocBody({ doc }: { doc: string }) {
  const d = DOCS[doc];
  if (!d) return null;
  return (
    <div className="space-y-6">
      {d.draft && (
        <Callout tone="neutral" icon="info">
          서비스 출시 전 법률 검토를 거쳐 확정할 초안이에요.
        </Callout>
      )}
      {d.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="px-1 text-[16px] font-semibold text-ink">{s.heading}</h2>
          <ul className="mt-2 space-y-2 rounded-[22px] bg-surface-2 p-4">
            {s.items.map((it) => (
              <li key={it} className="flex gap-2 text-[14.5px] leading-relaxed text-ink-2">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {it}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function Docs() {
  const { doc = 'terms' } = useParams();
  const d = DOCS[doc];
  return (
    <div className="min-h-dvh bg-bg">
      <TopBar title={d?.title ?? '문서'} back />
      <Page className="space-y-6">
        {!d ? (
          <p className="text-[15px] text-ink-2">
            찾는 문서가 없어요. <Link to="/docs/terms">이용약관 보기</Link>
          </p>
        ) : (
          <>
            <DocBody doc={doc} />
            <nav className="flex flex-wrap gap-x-4 gap-y-2 px-1 pb-6 text-[13px] text-muted" aria-label="다른 문서">
              {Object.entries(DOCS)
                .filter(([k]) => k !== doc)
                .map(([k, v]) => (
                  <Link key={k} to={`/docs/${k}`}>
                    {v.title}
                  </Link>
                ))}
            </nav>
          </>
        )}
      </Page>
    </div>
  );
}
