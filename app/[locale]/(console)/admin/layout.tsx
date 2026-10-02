import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

// 운영자 화면: 서버 claim(roles)으로만 판정한다. 권한이 없으면 존재 자체를 드러내지 않도록 404.
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "admin.view")) notFound();
  return <>{children}</>;
}
