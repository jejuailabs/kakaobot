import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConversationsView } from "@/features/admin/conversations-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/conversations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("conversations") };
}

export default function Page() {
  return <ConversationsView />;
}
