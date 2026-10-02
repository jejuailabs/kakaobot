import "./swc-cache-env";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // firebase-admin 은 번들하면 google-auth 계열 동적 로딩이 깨진다 → node_modules 에서 그대로 로드
  serverExternalPackages: ["firebase-admin"],
  // 클라이언트에 source map 을 공개하지 않는다 (docs/05 검증 항목).
  productionBrowserSourceMaps: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default withNextIntl(nextConfig);
