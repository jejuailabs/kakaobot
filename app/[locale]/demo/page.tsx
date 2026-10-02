import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardView } from "@/features/console/dashboard-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("dashboard") };
}

export default function Page() {
  return <DashboardView />;
}
