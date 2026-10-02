import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BotDetailView } from "@/features/bots/bot-detail-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/bots/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("bots") };
}

export default async function Page({ params }: PageProps<"/[locale]/bots/[id]">) {
  const { id } = await params;
  return <BotDetailView botId={id} />;
}
