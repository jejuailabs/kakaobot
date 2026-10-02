import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminOverview } from "@/features/admin/admin-overview";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("adminOverview") };
}

export default function Page() {
  return <AdminOverview />;
}
