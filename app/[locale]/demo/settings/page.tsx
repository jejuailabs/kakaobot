import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsView } from "@/features/console/settings-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("settings") };
}

export default function Page() {
  return <SettingsView />;
}
