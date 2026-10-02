import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { GatewaysView } from "@/features/admin/ops-views";
import { getSessionUser } from "@/lib/server/session";
import { can } from "@/lib/shared/rbac";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/gateways">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("gateways") };
}

export default async function Page() {
  const user = await getSessionUser();
  if (!user || !can(user.roles, "gateways.view")) notFound();
  return <GatewaysView />;
}
