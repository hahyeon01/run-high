/**
 * 시드 게시글용 일러스트 (실제 사진 대신 쓰는 SVG). 앱의 브랜드 색을 씁니다.
 */
function svg(body: string): string {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** 한강 일출 */
export const ART_SUNRISE = svg(`
<defs>
  <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6D57FC"/><stop offset=".55" stop-color="#F7A8C4"/><stop offset="1" stop-color="#FFD281"/></linearGradient>
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5040B8"/><stop offset="1" stop-color="#1E234B"/></linearGradient>
</defs>
<rect width="640" height="300" fill="url(#s)"/>
<circle cx="420" cy="250" r="62" fill="#FFF4DD" opacity=".95"/>
<rect y="292" width="640" height="188" fill="url(#w)"/>
<g fill="#1E234B" opacity=".85"><rect x="0" y="262" width="640" height="12"/><rect x="40" y="226" width="10" height="40"/><rect x="170" y="226" width="10" height="40"/><rect x="300" y="226" width="10" height="40"/><rect x="430" y="226" width="10" height="40"/><rect x="560" y="226" width="10" height="40"/></g>
<g stroke="#FFF4DD" stroke-width="4" stroke-linecap="round" opacity=".55"><path d="M360 320h120"/><path d="M380 350h80"/><path d="M395 380h50"/><path d="M405 410h30"/></g>
<path d="M0 470 C 160 430, 320 455, 640 420" stroke="#E8E4FF" stroke-width="6" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>`);

/** 야간 도심 러닝 */
export const ART_NIGHT = svg(`
<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E234B"/><stop offset="1" stop-color="#2E2A6B"/></linearGradient></defs>
<rect width="640" height="480" fill="url(#n)"/>
<g fill="#E8E4FF" opacity=".8"><circle cx="80" cy="60" r="2"/><circle cx="210" cy="40" r="1.5"/><circle cx="520" cy="70" r="2"/><circle cx="600" cy="30" r="1.5"/><circle cx="350" cy="50" r="1.5"/></g>
<circle cx="540" cy="90" r="34" fill="#FFF4DD" opacity=".9"/>
<g fill="#14183A"><rect x="20" y="200" width="70" height="200"/><rect x="100" y="150" width="60" height="250"/><rect x="170" y="230" width="80" height="170"/><rect x="260" y="120" width="56" height="280"/><rect x="330" y="190" width="90" height="210"/><rect x="430" y="160" width="64" height="240"/><rect x="505" y="215" width="110" height="185"/></g>
<g fill="#FFD281" opacity=".85"><rect x="112" y="170" width="8" height="10"/><rect x="132" y="200" width="8" height="10"/><rect x="272" y="150" width="8" height="10"/><rect x="292" y="190" width="8" height="10"/><rect x="345" y="220" width="8" height="10"/><rect x="445" y="185" width="8" height="10"/><rect x="465" y="230" width="8" height="10"/><rect x="525" y="240" width="8" height="10"/><rect x="40" y="230" width="8" height="10"/></g>
<rect y="400" width="640" height="80" fill="#0E1130"/>
<path d="M-10 455 C 150 420, 330 470, 650 425" stroke="#6D57FC" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M-10 455 C 150 420, 330 470, 650 425" stroke="#C9C0FF" stroke-width="3" fill="none" stroke-dasharray="1 18" stroke-linecap="round"/>`);

/** 육상 트랙 */
export const ART_TRACK = svg(`
<rect width="640" height="480" fill="#F0EEFF"/>
<g transform="translate(320 240)">
  <rect x="-290" y="-190" width="580" height="380" rx="190" fill="#D9694E"/>
  <rect x="-230" y="-130" width="460" height="260" rx="130" fill="#7CC8A0"/>
  <g fill="none" stroke="#FFF" stroke-width="2.5" opacity=".9">
    <rect x="-275" y="-175" width="550" height="350" rx="175"/><rect x="-260" y="-160" width="520" height="320" rx="160"/>
    <rect x="-245" y="-145" width="490" height="290" rx="145"/>
  </g>
  <path d="M-60 -190 V -130" stroke="#FFF" stroke-width="4"/>
  <rect x="-150" y="-40" width="300" height="80" rx="40" fill="#68B98F"/>
</g>`);

/** 단풍 공원 산책로 */
export const ART_PARK = svg(`
<rect width="640" height="480" fill="#FFF4DD"/>
<path d="M0 330 C 180 300, 460 320, 640 290 V480 H0Z" fill="#E6F8F0"/>
<path d="M250 480 C 300 400, 360 360, 470 300" stroke="#E8E4FF" stroke-width="70" fill="none" stroke-linecap="round"/>
<path d="M250 480 C 300 400, 360 360, 470 300" stroke="#C9C0FF" stroke-width="4" fill="none" stroke-dasharray="14 14"/>
<g><rect x="96" y="210" width="12" height="120" fill="#8A5A3B"/><circle cx="102" cy="190" r="70" fill="#FF9F1C"/><circle cx="60" cy="230" r="40" fill="#FFB84D"/></g>
<g><rect x="530" y="180" width="12" height="130" fill="#8A5A3B"/><circle cx="536" cy="160" r="64" fill="#F04D5E" opacity=".9"/><circle cx="586" cy="200" r="38" fill="#FF9F1C"/></g>
<g><rect x="380" y="170" width="10" height="110" fill="#8A5A3B"/><circle cx="385" cy="150" r="52" fill="#FFD281"/></g>
<circle cx="560" cy="60" r="30" fill="#FFD281" opacity=".7"/>`);

export const SEED_ART = { sunrise: ART_SUNRISE, night: ART_NIGHT, track: ART_TRACK, park: ART_PARK };
