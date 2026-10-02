import localFont from "next/font/local";

// 모든 폰트를 로컬 파일로 self-host 한다 (빌드 시 외부 다운로드 없음).
// Korean: Pretendard (OFL), Latin: Inter (OFL, @fontsource-variable/inter).
// 일본어는 globals.css 의 시스템 폰트 fallback(Hiragino/Yu Gothic/Noto Sans JP)을 쓴다.
export const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
