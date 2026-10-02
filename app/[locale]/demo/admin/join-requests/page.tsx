import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JoinRequestsView } from "@/features/admin/ops-views";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin/join-requests">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("joinRequests") };
}

export default function Page() {
  return <JoinRequestsView />;
}
