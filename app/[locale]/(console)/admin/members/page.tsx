import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminNotReady } from "@/features/admin/live/not-ready";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/members">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("members") };
}

export default function Page() {
  return <AdminNotReady />;
}
