import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MembersView } from "@/features/admin/members-view";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/members">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("members") };
}

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "members.view")) notFound();
  return <MembersView />;
}
