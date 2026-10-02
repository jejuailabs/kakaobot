import { useTranslations } from "next-intl";
import { LocaleMenu } from "@/components/glass/locale-menu";
import { BrandMark } from "@/components/glass/shell";
import { ThemeToggle } from "@/components/glass/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function PublicHeader({ showLogin = true }: { showLogin?: boolean }) {
  const t = useTranslations("landing");
  return (
    <header className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between gap-3 px-4 md:px-10">
      <Link href="/" aria-label="Katcha" className="rounded-[12px]">
        <BrandMark />
      </Link>
      <div className="flex items-center gap-2">
        <LocaleMenu className="hidden sm:inline-flex" />
        <LocaleMenu className="sm:hidden" compact />
        <ThemeToggle />
        {showLogin && (
          <Button asChild size="sm" variant="secondary" className="h-10 px-4">
            <Link href="/login">{t("login")}</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
