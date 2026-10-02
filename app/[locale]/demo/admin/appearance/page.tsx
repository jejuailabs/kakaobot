import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppearanceView } from "@/features/admin/appearance-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin/appearance">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("appearance") };
}

export default function Page() {
  return <AppearanceView />;
}
