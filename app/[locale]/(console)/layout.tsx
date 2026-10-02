import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";

// 실제 콘솔: 검증된 server session 이 있어야 한다. S2 에서 Firebase session + live 데이터 provider 가 연결된다.
// 그 전까지는 항상 로그인 화면으로 보내며, demo 숫자를 이 경로에 주입하지 않는다.
export default async function ConsoleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);
  return <>{children}</>;
}
