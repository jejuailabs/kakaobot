import { getTranslations } from "next-intl/server";
import { ErrorBanner } from "@/components/glass/glass-card";

/** 실제 운영 데이터 연결 전(S6/S7) 화면. 화면 구성은 /demo/admin 에서 볼 수 있다. */
export async function AdminNotReady() {
  const t = await getTranslations("admin");
  return <ErrorBanner tone="info" title={t("liveNotReadyTitle")} description={t("liveNotReadyDesc")} />;
}
