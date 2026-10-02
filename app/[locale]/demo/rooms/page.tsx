import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoomsView } from "@/features/rooms/rooms-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/demo/rooms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("rooms") };
}

export default function Page() {
  return <RoomsView />;
}
