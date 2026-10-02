import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LiveJoinQueue } from "@/features/admin/live/join-queue";
import { listJoinQueue } from "@/lib/server/connection";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/join-requests">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("joinRequests") };
}

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "joins.manage")) notFound();
  return <LiveJoinQueue items={await listJoinQueue()} />;
}
