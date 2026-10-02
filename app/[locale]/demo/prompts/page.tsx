import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PromptsView } from "@/features/bots/prompts-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/prompts">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("prompts") };
}

export default function Page() {
  return <PromptsView />;
}
