// 기본 Liquid Glass 배경을 코드로 생성한다 (외부 사진·라이선스 의존 없음).
// 구성: 위 25% 구름, 중간 40% 능선, 하단 35% 호수 (docs/02 배경 에셋).
// 실행: npm run assets:backgrounds
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const W = 2560;
const H = 1440;
const OUT = path.resolve("public/backgrounds");

const palettes = {
  dark: {
    sky: ["#0b2236", "#17405b", "#3d5f86", "#7d7fb0", "#d8a9a6"],
    glow: "#ffd2b8",
    cloud: "#e8eefc",
    cloudOpacity: 0.32,
    ridges: [
      ["#5a6f98", "#41597f"],
      ["#3a5676", "#2a4561"],
      ["#22405a", "#183247"],
      ["#13304a", "#0c2235"],
    ],
    lake: ["#1d4560", "#123247", "#0a2132"],
    shimmer: "#bfe8ff",
  },
  light: {
    sky: ["#9fcde4", "#bfdcef", "#d6d8f3", "#f0d9e2", "#fbe3d3"],
    glow: "#fff1e2",
    cloud: "#ffffff",
    cloudOpacity: 0.7,
    ridges: [
      ["#a9b9dc", "#97a9d0"],
      ["#7f9cbf", "#6c8bb0"],
      ["#5d84a3", "#4b7394"],
      ["#3f6a86", "#335c77"],
    ],
    lake: ["#8fc3d8", "#6ea9c2", "#4f8eab"],
    shimmer: "#ffffff",
  },
};

// 결정적 의사난수 (매 실행 동일 결과)
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function ridgePath(baseY, amp, seed, roughness) {
  const r = rng(seed);
  const pts = [];
  const steps = 48;
  let y = baseY;
  for (let i = 0; i <= steps; i++) {
    const x = -120 + ((W + 240) / steps) * i;
    const peak = Math.sin(i / 4.3 + seed) * amp * 0.6 + Math.sin(i / 1.7 + seed * 2) * amp * 0.25 + Math.abs(Math.sin(i / 0.9 + seed * 3)) * amp * 0.18;
    y = baseY - Math.abs(peak) - r() * roughness;
    pts.push([x, y]);
  }
  let d = `M-120 ${H} L-120 ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` Q${x0.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  d += ` L${W + 120} ${pts[pts.length - 1][1].toFixed(1)} L${W + 120} ${H} Z`;
  return d;
}

function clouds(p, seed) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < 14; i++) {
    const cx = r() * W;
    const cy = 80 + r() * 300;
    const rx = 220 + r() * 420;
    const ry = 40 + r() * 70;
    out += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${p.cloud}" opacity="${(p.cloudOpacity * (0.5 + r() * 0.5)).toFixed(2)}"/>`;
  }
  return out;
}

function shimmer(p, seed, horizon) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < 70; i++) {
    const y = horizon + 30 + Math.pow(r(), 1.6) * (H - horizon - 40);
    const len = 40 + r() * 260 * ((y - horizon) / (H - horizon) + 0.3);
    const x = r() * W;
    out += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${len.toFixed(0)}" height="2" rx="1" fill="${p.shimmer}" opacity="${(0.06 + r() * 0.12).toFixed(2)}"/>`;
  }
  return out;
}

function svg(theme) {
  const p = palettes[theme];
  const horizon = Math.round(H * 0.65); // 하단 35% 호수
  const ridgeDefs = p.ridges
    .map(
      ([a, b], i) =>
        `<linearGradient id="r${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`,
    )
    .join("");
  const ridgeSpecs = [
    [horizon - 300, 180, 3.1, 30],
    [horizon - 190, 150, 7.7, 26],
    [horizon - 90, 110, 1.9, 18],
    [horizon - 10, 70, 5.3, 10],
  ];
  const ridges = ridgeSpecs
    .map(([y, amp, seed, rough], i) => `<path d="${ridgePath(y, amp, seed, rough)}" fill="url(#r${i})"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      ${p.sky.map((c, i) => `<stop offset="${(i / (p.sky.length - 1)) * 0.68}" stop-color="${c}"/>`).join("")}
    </linearGradient>
    <radialGradient id="glow" cx="0.58" cy="0.5" r="0.45">
      <stop offset="0" stop-color="${p.glow}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      ${p.lake.map((c, i) => `<stop offset="${i / (p.lake.length - 1)}" stop-color="${c}"/>`).join("")}
    </linearGradient>
    ${ridgeDefs}
    <filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>
    <filter id="haze" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="reflect"><feGaussianBlur stdDeviation="14"/></filter>
    <clipPath id="above"><rect x="0" y="0" width="${W}" height="${horizon}"/></clipPath>
    <clipPath id="below"><rect x="0" y="${horizon}" width="${W}" height="${H - horizon}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g filter="url(#soft)">${clouds(p, 11)}</g>
  <g clip-path="url(#above)"><g filter="url(#haze)">${ridges}</g></g>
  <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#lake)"/>
  <g clip-path="url(#below)" opacity="0.42" filter="url(#reflect)">
    <g transform="translate(0 ${horizon * 2}) scale(1 -1)">${ridges}</g>
  </g>
  <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#lake)" opacity="0.45"/>
  ${shimmer(p, 23, horizon)}
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const theme of ["dark", "light"]) {
    const base = sharp(Buffer.from(svg(theme)), { density: 72 });
    const png = await base.png().toBuffer();

    const desktop = path.join(OUT, `landscape-${theme}.webp`);
    await sharp(png).webp({ quality: 80, effort: 6 }).toFile(desktop);

    // 모바일: 초점 40% 50% 기준 9:16 crop → 1080px
    const cropW = Math.round((H * 9) / 16);
    const left = Math.max(0, Math.min(W - cropW, Math.round(W * 0.4 - cropW / 2)));
    const mobile = path.join(OUT, `landscape-${theme}-mobile.webp`);
    await sharp(png)
      .extract({ left, top: 0, width: cropW, height: H })
      .resize({ width: 1080 })
      .webp({ quality: 78, effort: 6 })
      .toFile(mobile);

    for (const f of [desktop, mobile]) {
      const { size } = await stat(f);
      console.log(`${path.basename(f)}  ${(size / 1024).toFixed(0)}KB`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
