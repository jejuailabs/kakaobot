import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JobsView } from "@/features/admin/ops-views";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin/jobs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("jobs") };
}

export default function Page() {
  return <JobsView />;
}
