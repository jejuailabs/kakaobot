import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // API, Next 내부 파일, 정적 파일(확장자 포함)은 locale 처리에서 제외한다.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
