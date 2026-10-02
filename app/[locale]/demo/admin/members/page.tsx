import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MembersView } from "@/features/admin/members-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/admin/members">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("members") };
}

export default function Page() {
  return <MembersView />;
}
