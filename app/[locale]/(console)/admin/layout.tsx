import { notFound } from "next/navigation";
import { LiveAdminProvider } from "@/features/admin/live/live-admin-provider";
import { loadAdminData } from "@/lib/server/admin-data";
import { getSessionUser } from "@/lib/server/session";
import { can, type AdminRole } from "@/lib/shared/rbac";

// 운영자 화면: 서버 claim(roles)으로만 판정한다. 권한이 없으면 존재 자체를 드러내지 않도록 404.
// 화면별 세부 권한(원문 열람·회원 관리 등)은 각 page 와 API 에서 다시 확인한다.
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "admin.view")) notFound();
  const role: AdminRole = user.roles[0] ?? "analyst";
  return (
    <LiveAdminProvider data={await loadAdminData()} role={role}>
      {children}
    </LiveAdminProvider>
  );
}
