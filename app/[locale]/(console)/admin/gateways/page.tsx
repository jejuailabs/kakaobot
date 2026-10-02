import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GatewaysView } from "@/features/admin/ops-views";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/gateways">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("gateways") };
}

export default function Page() {
  return <GatewaysView />;
}
