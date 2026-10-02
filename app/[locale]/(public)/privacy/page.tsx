import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicHeader } from "@/features/landing/public-header";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title") };
}

const ITEMS = ["account", "messages", "retention", "ai", "delete"] as const;

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-10">
        <article className="glass-panel p-6 md:p-10">
          <h1 className="text-heading font-[650]">{t("title")}</h1>
          <p className="mt-2 text-body text-muted">{t("intro")}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {ITEMS.map((k) => (
              <li key={k} className="glass-card p-4 text-body">{t(`items.${k}`)}</li>
            ))}
          </ul>
        </article>
      </main>
    </div>
  );
}
