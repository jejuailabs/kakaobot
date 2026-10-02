import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BotsView } from "@/features/bots/bots-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/bots">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("bots") };
}

export default function Page() {
  return <BotsView />;
}
