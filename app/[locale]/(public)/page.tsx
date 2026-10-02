import { ArrowRight, Link2, Rocket, SlidersHorizontal, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import { GoogleMark } from "@/components/glass/google-mark";
import { Button } from "@/components/ui/button";
import { HeroPreview } from "@/features/landing/hero-preview";
import { PublicHeader } from "@/features/landing/public-header";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: { absolute: t("title") } };
}

export default function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("landing");

  const features = [
    { key: "create", icon: Sparkles },
    { key: "connect", icon: Link2 },
    { key: "customize", icon: SlidersHorizontal },
    { key: "grow", icon: Rocket },
  ] as const;

  const steps = ["step1", "step2", "step3", "step4"] as const;

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main id="main">
        <section className="mx-auto grid w-full max-w-[1440px] items-center gap-10 px-4 pb-12 pt-6 md:px-10 min-[1360px]:min-h-[min(820px,calc(100dvh-72px))] min-[1360px]:grid-cols-[28fr_72fr] min-[1360px]:gap-8 min-[1360px]:pb-16">
          <div className="relative z-10 max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-glass-border bg-[color-mix(in_srgb,var(--glass-fill)_80%,transparent)] px-3 py-1 text-caption font-semibold text-muted backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {t("eyebrow")}
            </p>
            <h1 className="font-display text-[34px] font-normal leading-[40px] tracking-tight md:text-[44px] md:leading-[48px] xl:text-[56px] xl:leading-[62px] min-[1360px]:text-[64px] min-[1360px]:leading-[68px]">
              {t("title")}
            </h1>
            <p className="mt-5 text-[17px] leading-7 text-muted">{t("subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="primary">
                <Link href="/login">
                  <GoogleMark />
                  {t("ctaPrimary")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/demo">
                  {t("ctaSecondary")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-5 rounded-[12px] bg-[color-mix(in_srgb,var(--glass-fill)_75%,transparent)] px-3 py-2 text-caption text-muted backdrop-blur-md">{t("disclaimer")}</p>
          </div>
          <div className="relative min-w-0">
            <HeroPreview />
            <p className="mt-3 text-center text-caption text-muted min-[1360px]:text-right">{t("previewNote")}</p>
          </div>
        </section>

        <section aria-labelledby="features-title" className="mx-auto w-full max-w-[1280px] px-4 pb-16 md:px-10">
          <h2 id="features-title" className="sr-only">
            {t("featuresTitle")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ key, icon: Icon }) => (
              <GlassCard as="li" key={key} className="flex flex-col gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-[12px] bg-selected text-primary" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <h3 className="text-section font-semibold">{t(`features.${key}.title`)}</h3>
                <p className="text-body text-muted">{t(`features.${key}.desc`)}</p>
              </GlassCard>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-title" className="mx-auto w-full max-w-[1280px] px-4 pb-20 md:px-10">
          <div className="glass-panel p-6 md:p-10">
            <h2 id="how-title" className="text-heading font-semibold">
              {t("howTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-body text-muted">{t("howDesc")}</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s} className="glass-card flex gap-4 p-5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-label font-bold text-primary-fg tabular">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{t(`how.${s}.title`)}</p>
                    <p className="mt-1 text-label text-muted">{t(`how.${s}.desc`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-4 pb-10 text-caption text-muted md:flex-row md:justify-between md:px-10">
        <p>© Katcha</p>
        <p>{t("footerNote")}</p>
      </footer>
    </div>
  );
}
