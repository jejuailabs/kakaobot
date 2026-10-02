import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdminOverview } from "@/features/admin/admin-overview";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("adminOverview") };
}

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "metrics.view")) notFound();
  return <AdminOverview />;
}
