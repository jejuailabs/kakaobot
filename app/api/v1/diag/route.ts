import { NextResponse } from "next/server";

// 임시 진단용: Vercel 500 원인 확인 후 삭제한다. 비밀값은 출력하지 않는다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const steps: { step: string; ok: boolean; detail?: string }[] = [];
  const run = async (step: string, fn: () => Promise<string | void>) => {
    try {
      const detail = await fn();
      steps.push({ step, ok: true, detail: detail || undefined });
      return true;
    } catch (e) {
      const err = e as { code?: string; message?: string };
      steps.push({ step, ok: false, detail: `${err.code ?? ""} ${String(err.message ?? e).slice(0, 400)}` });
      return false;
    }
  };
  await run("node", async () => process.version);
  await run("env present", async () => {
    const raw = process.env.FIREBASE_ADMIN_CREDENTIALS ?? "";
    return `len=${raw.length} startsWithBrace=${raw.trim().startsWith("{")} hasQuote=${/^["']/.test(raw)} public=${Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}`;
  });
  await run("parse credentials", async () => {
    const raw = (process.env.FIREBASE_ADMIN_CREDENTIALS ?? "").trim();
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as Record<string, string>;
    return `project=${sa.project_id} keyLooksPem=${String(sa.private_key ?? "").includes("BEGIN PRIVATE KEY")}`;
  });
  await run("import firebase-admin/app", async () => void (await import("firebase-admin/app")));
  await run("import firebase-admin/auth", async () => void (await import("firebase-admin/auth")));
  await run("import firebase-admin/firestore", async () => void (await import("firebase-admin/firestore")));
  await run("import lib/server/firebase-admin", async () => void (await import("@/lib/server/firebase-admin")));
  await run("import lib/server/session", async () => void (await import("@/lib/server/session")));
  await run("adminAuth().listUsers(1)", async () => {
    const m = await import("@/lib/server/firebase-admin");
    const r = await m.adminAuth().listUsers(1);
    return `users=${r.users.length}`;
  });
  return NextResponse.json({ steps });
}
