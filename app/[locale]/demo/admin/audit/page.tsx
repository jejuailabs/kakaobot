import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuditView } from "@/features/admin/ops-views";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin/audit">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("audit") };
}

export default function Page() {
  return <AuditView />;
}
