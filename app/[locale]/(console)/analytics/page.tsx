import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnalyticsView } from "@/features/analytics/analytics-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/analytics">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("analytics") };
}

export default function Page() {
  return <AnalyticsView />;
}
