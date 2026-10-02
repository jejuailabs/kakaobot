"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserSessionPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";

// 브라우저용 Firebase (공개 웹 설정만 사용). Analytics 는 쿠키 동의 절차 전까지 쓰지 않는다.

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  auth = getAuth(app);
  // 서버 session cookie 가 기준이므로 브라우저 쪽 로그인 상태는 탭 단위로만 유지한다.
  void setPersistence(auth, browserSessionPersistence);
  return auth;
}

const CSRF_COOKIE = "katcha_csrf";

/** double-submit CSRF 토큰: 같은 값을 쿠키와 헤더로 보낸다. */
export function csrfToken(): string {
  const existing = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  if (existing) return existing.split("=")[1];
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  document.cookie = `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict${location.protocol === "https:" ? "; Secure" : ""}`;
  return token;
}

export async function sessionRequest(method: "POST" | "DELETE", body?: unknown) {
  return fetch("/api/v1/auth/session", {
    method,
    headers: { "content-type": "application/json", "x-katcha-csrf": csrfToken() },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
}
