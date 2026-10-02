// 배경 manifest. 컴포넌트에 URL 을 하드코딩하지 않고 이 manifest → CSS 변수로 바인딩한다.
// S7 에서 siteAppearance 의 활성 버전을 서버에서 읽어 같은 형태로 내려준다.

export type BackgroundVariant = {
  versionId: string;
  desktopUrl: string;
  mobileUrl: string;
  overlay: string; // rgba
  blurPx: number; // 0~8
  brightness: number; // 0.6~1.2
  focusDesktop: string;
  focusMobile: string;
};

export type AppearanceManifest = {
  version: number;
  light: BackgroundVariant;
  dark: BackgroundVariant;
};

export const DEFAULT_APPEARANCE: AppearanceManifest = {
  version: 0,
  light: {
    versionId: "builtin-light",
    desktopUrl: "/backgrounds/landscape-light.webp",
    mobileUrl: "/backgrounds/landscape-light-mobile.webp",
    overlay: "rgba(234, 245, 250, 0.18)",
    blurPx: 0,
    brightness: 1,
    focusDesktop: "50% 55%",
    focusMobile: "40% 50%",
  },
  dark: {
    versionId: "builtin-dark",
    desktopUrl: "/backgrounds/landscape-dark.webp",
    mobileUrl: "/backgrounds/landscape-dark-mobile.webp",
    overlay: "rgba(6, 26, 42, 0.16)",
    blurPx: 0,
    brightness: 1,
    focusDesktop: "50% 55%",
    focusMobile: "40% 50%",
  },
};

function vars(v: BackgroundVariant) {
  return [
    `--bg-image:url("${v.desktopUrl}")`,
    `--bg-image-mobile:url("${v.mobileUrl}")`,
    `--bg-overlay:${v.overlay}`,
    `--bg-blur:${v.blurPx}px`,
    `--bg-brightness:${v.brightness}`,
    `--bg-focus:${v.focusDesktop}`,
    `--bg-focus-mobile:${v.focusMobile}`,
  ].join(";");
}

/** :root / .dark 에 주입할 CSS. 이미지 로딩 실패 시 --bg-fallback gradient 가 아래에 남는다. */
export function appearanceCss(m: AppearanceManifest): string {
  return `:root{${vars(m.light)}}.dark{${vars(m.dark)}}`;
}
