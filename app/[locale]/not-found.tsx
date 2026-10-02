import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/glass/glass-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass-panel w-full max-w-md">
        <EmptyState
          icon={<Compass />}
          title={t("pageNotFound")}
          description={t("pageNotFoundDesc")}
          action={
            <Button asChild>
              <Link href="/">{t("goHome")}</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
