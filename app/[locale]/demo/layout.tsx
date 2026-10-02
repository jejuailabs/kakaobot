import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { ConsoleFrame } from "@/features/console/console-frame";
import { DemoConsoleProvider } from "@/features/console/demo-provider";
import { demoSnapshot } from "@/lib/shared/demo-data";

// /demo: 로그인 없이 보는 mock 콘솔. 모든 값은 DEMO 데이터이며 이 브라우저 탭에만 저장된다.
export default async function DemoLayout({ children, params }: LayoutProps<"/[locale]/demo">) {
  await connection(); // 요청 시각 기준으로 demo 시간을 만든다 (빌드 시각 고정 방지)
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <DemoConsoleProvider initial={demoSnapshot()}>
      <ConsoleFrame>{children}</ConsoleFrame>
    </DemoConsoleProvider>
  );
}
