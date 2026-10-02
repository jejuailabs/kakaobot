import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ErrorBanner } from "@/components/glass/glass-card";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

// 운영자 화면: 서버 claim(roles)으로만 판정한다. 권한이 없으면 존재 자체를 드러내지 않도록 404.
// 운영자용 실제 데이터(회원·대화·배경)는 S6/S7 에서 /api/v1/admin/* 로 연결된다.
export default async function AdminLayout({ params }: LayoutProps<"/[locale]/admin">) {
  await params;
  const user = await getSessionUser();
  if (!user || !can(user.roles, "admin.view")) notFound();
  const t = await getTranslations("admin");
  return <ErrorBanner tone="info" title={t("liveNotReadyTitle")} description={t("liveNotReadyDesc")} />;
}
