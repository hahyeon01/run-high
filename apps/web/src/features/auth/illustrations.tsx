/** 온보딩 일러스트: 레퍼런스의 3D 일러스트 자리에 앱의 실제 요소(배번 카드, 경로, 접수 알림)를 단순화해 그림 */

export function IllustBib() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" aria-hidden>
      <rect x="40" y="58" width="240" height="150" rx="26" fill="#1E234B" />
      <rect x="40" y="58" width="240" height="150" rx="26" fill="url(#lanes)" opacity="0.25" />
      <defs>
        <pattern id="lanes" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <rect width="2" height="24" fill="#fff" />
        </pattern>
      </defs>
      <circle cx="68" cy="84" r="5" fill="#fff" opacity=".5" />
      <circle cx="252" cy="84" r="5" fill="#fff" opacity=".5" />
      <text x="62" y="146" fill="#fff" fontFamily="Urbanist Variable, sans-serif" fontWeight="700" fontSize="58" letterSpacing="-2">6'00"</text>
      <text x="64" y="178" fill="#C9C0FF" fontFamily="Pretendard Variable, sans-serif" fontSize="15">10km · 반포한강공원</text>
      <circle cx="240" cy="168" r="22" fill="#fff" />
      <path d="M233 168l5 5 10-11" stroke="#6D57FC" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="196" y="30" width="96" height="40" rx="20" fill="#E2F6EF" />
      <text x="244" y="55" textAnchor="middle" fill="#0F9D74" fontFamily="Pretendard Variable, sans-serif" fontWeight="700" fontSize="14">바로 참여</text>
    </svg>
  );
}

export function IllustRecords() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" aria-hidden>
      <rect x="36" y="40" width="248" height="168" rx="26" fill="#fff" />
      <path d="M70 160c20-40 40-60 70-50s36 40 66 22 30-60 54-66" stroke="#6D57FC" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="70" cy="160" r="8" fill="#0F9D74" stroke="#fff" strokeWidth="3" />
      <circle cx="260" cy="66" r="8" fill="#1E234B" stroke="#fff" strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={70 + i * 26} y={196 - [14, 22, 18, 30, 26, 34, 28, 40][i]} width="12" height={[14, 22, 18, 30, 26, 34, 28, 40][i]} rx="3" fill={i === 7 ? '#6D57FC' : '#C9C0FF'} />
      ))}
      <rect x="196" y="18" width="100" height="40" rx="20" fill="#FFF4DD" />
      <text x="246" y="43" textAnchor="middle" fill="#8a5a00" fontFamily="Pretendard Variable, sans-serif" fontWeight="700" fontSize="14">최근 8주</text>
    </svg>
  );
}

export function IllustRace() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" aria-hidden>
      <rect x="54" y="44" width="212" height="164" rx="26" fill="#fff" />
      <rect x="54" y="44" width="212" height="44" rx="22" fill="#FFD281" />
      <rect x="54" y="66" width="212" height="22" fill="#FFD281" />
      <text x="160" y="74" textAnchor="middle" fill="#8a5a00" fontFamily="Pretendard Variable, sans-serif" fontWeight="700" fontSize="16">접수 오픈</text>
      <text x="160" y="148" textAnchor="middle" fill="#1E234B" fontFamily="Urbanist Variable, sans-serif" fontWeight="700" fontSize="52">10:00</text>
      <text x="160" y="182" textAnchor="middle" fill="#8B88A1" fontFamily="Pretendard Variable, sans-serif" fontSize="14">하루 전 · 10분 전 · 오픈</text>
      <circle cx="254" cy="52" r="26" fill="#6D57FC" stroke="#fff" strokeWidth="4" />
      <path d="M254 40c-6 0-10 4-10 10v6l-3 4h26l-3-4v-6c0-6-4-10-10-10zM250 63a4 4 0 0 0 8 0" fill="#fff" />
    </svg>
  );
}
