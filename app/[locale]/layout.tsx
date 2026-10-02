import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/primitives";
import { ToastProvider } from "@/components/ui/toast";
import { routing } from "@/i18n/routing";
import { appearanceCss, DEFAULT_APPEARANCE } from "@/lib/shared/appearance";
import { inter, pretendard } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: t("title"), template: "%s · Katcha" },
    description: t("description"),
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a2336" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // S7 에서 siteAppearance 활성 버전으로 교체된다. 지금은 내장 기본 배경.
  const appearance = DEFAULT_APPEARANCE;

  return (
    <html lang={locale} suppressHydrationWarning className={`${pretendard.variable} ${inter.variable}`}>
      <head>
        <link rel="preload" as="image" href={appearance.dark.desktopUrl} media="(min-width: 768px)" />
        <style id="katcha-appearance" dangerouslySetInnerHTML={{ __html: appearanceCss(appearance) }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="katcha-theme">
          <NextIntlClientProvider>
            <TooltipProvider>
              <ToastProvider>
                <div className="glass-backdrop" aria-hidden />
                {children}
              </ToastProvider>
            </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
