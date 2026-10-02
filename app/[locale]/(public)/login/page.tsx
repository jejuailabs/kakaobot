import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { GoogleSignIn } from "@/features/auth/google-sign-in";
import { PublicHeader } from "@/features/landing/public-header";
import { Link } from "@/i18n/navigation";
import { isFirebaseClientConfigured } from "@/lib/shared/config";
import { isAdminConfigured } from "@/lib/server/firebase-admin";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("metaTitle") };
}

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");
  const configured = isFirebaseClientConfigured() && isAdminConfigured();

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader showLogin={false} />
      <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="glass-panel w-full max-w-[420px] p-6 text-center md:p-8">
          <h1 className="font-display text-[30px] leading-9">{t("welcome")}</h1>
          <p className="mt-3 text-body text-muted">{t("subtitle")}</p>

          <div className="mt-8 flex flex-col gap-3">
            {configured ? (
              <GoogleSignIn />
            ) : (
              <Button size="lg" variant="secondary" className="w-full" disabled aria-describedby="login-unconfigured">
                {t("google")}
              </Button>
            )}
            {!configured && (
              <p id="login-unconfigured" className="flex items-start gap-2 rounded-[12px] bg-selected p-3 text-left text-label text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {t("unconfigured")}
              </p>
            )}
            <Button asChild variant="ghost" className="w-full">
              <Link href="/demo">
                {t("demo")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="mt-8 text-caption text-muted">
            {t.rich("privacy", {
              link: (chunks) => (
                <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </main>
    </div>
  );
}
