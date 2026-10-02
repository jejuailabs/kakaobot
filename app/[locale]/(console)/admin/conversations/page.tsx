import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ConversationsView } from "@/features/admin/conversations-view";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/conversations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("conversations") };
}

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "conversations.view")) notFound();
  return <ConversationsView />;
}
