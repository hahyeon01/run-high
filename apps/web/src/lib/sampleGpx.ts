/**
 * 데모 체험용 샘플 GPX: 웹에서 실제로 달리지 않고도 "파일 가져오기 → 인증 기록" 흐름을 볼 수 있게
 * 집결지 주변을 한 바퀴 도는 기록을 만들어 줍니다.
 */
export function makeSampleGpx(opts: { lat: number; lng: number; km: number; paceS: number; endAt: Date; name?: string }): string {
  const { lat, lng, km, paceS, endAt } = opts;
  const totalS = Math.round(km * paceS);
  const step = 3;
  const n = Math.floor(totalS / step);
  const start = endAt.getTime() - totalS * 1000;
  const r = (km * 1000) / (2 * Math.PI);
  const mLat = 1 / 111_320;
  const mLng = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const rr = r * (1 + Math.sin(2 * a + 0.7) * 0.15 + Math.sin(3 * a) * 0.05);
    const x = Math.cos(a) * rr * 1.3 - r * 1.3;
    const y = (Math.sin(a) * rr) / 1.3;
    const plat = (lat + y * mLat).toFixed(6);
    const plng = (lng + x * mLng).toFixed(6);
    const t = new Date(start + i * step * 1000).toISOString();
    pts.push(`      <trkpt lat="${plat}" lon="${plng}"><ele>${(12 + Math.sin(a * 2) * 3).toFixed(1)}</ele><time>${t}</time></trkpt>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Runhigh sample" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${new Date(start).toISOString()}</time></metadata>
  <trk>
    <name>${opts.name ?? '샘플 러닝'}</name>
    <type>running</type>
    <trkseg>
${pts.join('\n')}
    </trkseg>
  </trk>
</gpx>
`;
}
