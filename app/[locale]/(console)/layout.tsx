import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ErrorBanner } from "@/components/glass/glass-card";
import { ConsoleFrame } from "@/features/console/console-frame";
import { LiveConsoleProvider } from "@/features/console/live-provider";
import { loadConsoleSnapshot } from "@/lib/server/console-data";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

// 실제 콘솔: 서버에서 검증한 session 이 있어야 한다. demo 숫자는 이 경로에 절대 주입하지 않는다.
export default async function ConsoleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  if (user.status !== "active") {
    const t = await getTranslations("login");
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md">
          <ErrorBanner title={t("errorSuspended")} />
        </div>
      </main>
    );
  }

  const snapshot = await loadConsoleSnapshot(user);
  return (
    <LiveConsoleProvider initial={snapshot} canAdmin={can(user.roles, "admin.view")}>
      <ConsoleFrame>{children}</ConsoleFrame>
    </LiveConsoleProvider>
  );
}
