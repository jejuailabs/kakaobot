"use client";

import { FirebaseError } from "firebase/app";
import { getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, type UserCredential } from "firebase/auth";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { ErrorBanner } from "@/components/glass/glass-card";
import { GoogleMark } from "@/components/glass/google-mark";
import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import { firebaseAuth, sessionRequest } from "@/lib/client/firebase";
import { safeNextPath } from "@/lib/shared/redirect";

const CANCEL_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);
const REDIRECT_CODES = new Set(["auth/popup-blocked", "auth/operation-not-supported-in-environment"]);

/** 로그인 후 이동할 내부 경로. locale prefix 가 없으면 현재 locale 을 붙인다. */
function destination(locale: string): string {
  const next = safeNextPath(new URLSearchParams(window.location.search).get("next"), "/dashboard");
  const hasLocale = routing.locales.some((l) => next === `/${l}` || next.startsWith(`/${l}/`));
  return hasLocale ? next : `/${locale}${next}`;
}

export function GoogleSignIn() {
  const t = useTranslations("login");
  const locale = useLocale();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const finish = React.useCallback(
    async (cred: UserCredential) => {
      const idToken = await cred.user.getIdToken();
      const res = await sessionRequest("POST", { idToken, locale });
      if (res.ok) {
        // 서버 session cookie 를 받은 뒤 전체 이동해 서버 렌더가 새 session 을 읽게 한다.
        window.location.assign(destination(locale));
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { messageKey?: string } } | null;
      await signOut(firebaseAuth()).catch(() => {});
      const key = body?.error?.messageKey ?? "login.errorGeneric";
      setError(key.startsWith("login.") ? t(key.slice(6)) : t("errorGeneric"));
      setBusy(false);
    },
    [locale, t],
  );

  // popup 이 막혀 redirect 로 로그인한 경우 결과를 처리한다.
  React.useEffect(() => {
    let cancelled = false;
    getRedirectResult(firebaseAuth())
      .then((cred) => {
        if (cred && !cancelled) {
          setBusy(true);
          return finish(cred);
        }
      })
      .catch(() => !cancelled && setError(t("errorGeneric")));
    return () => {
      cancelled = true;
    };
  }, [finish, t]);

  async function start() {
    setBusy(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const cred = await signInWithPopup(firebaseAuth(), provider);
      await finish(cred);
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : "";
      if (REDIRECT_CODES.has(code)) {
        await signInWithRedirect(firebaseAuth(), provider);
        return;
      }
      setBusy(false);
      // 사용자가 창을 닫은 경우는 오류로 보지 않고 로그인 화면에 머문다.
      if (!CANCEL_CODES.has(code)) setError(code === "auth/unauthorized-domain" ? t("errorDomain") : t("errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" variant="secondary" className="w-full bg-white text-[#1f1f1f] dark:bg-white dark:text-[#1f1f1f]" onClick={start} loading={busy}>
        {!busy && <GoogleMark />}
        {t("google")}
      </Button>
      <div aria-live="polite">{error && <ErrorBanner title={error} className="text-left" />}</div>
    </div>
  );
}
