import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError } from "./api";
import { adminDb } from "./firebase-admin";

// wizard 임시 저장. 브라우저 localStorage 에는 draft ID 만 두고 내용(프롬프트 등)은 서버에 둔다 (docs/03).
const DRAFT_TTL_MS = 7 * 24 * 3600_000;
const idSchema = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const draftSchema = z.object({ step: z.number().int().min(0).max(3), values: z.record(z.string(), z.unknown()) });

const ref = (workspaceId: string, draftId: string) => {
  if (!idSchema.safeParse(draftId).success) throw apiError(404, "not_found");
  return adminDb().collection("wizardDrafts").doc(`${workspaceId}__${draftId}`);
};

export async function getDraft(workspaceId: string, draftId: string) {
  const snap = await ref(workspaceId, draftId).get();
  const d = snap.data();
  if (!snap.exists || d?.workspaceId !== workspaceId || (d.expiresAt as Timestamp).toMillis() < Date.now()) throw apiError(404, "not_found");
  return { id: draftId, step: d.step as number, values: d.values, updatedAt: (d.updatedAt as Timestamp | undefined)?.toDate().toISOString() ?? new Date().toISOString() };
}

export async function saveDraft(workspaceId: string, draftId: string, body: unknown) {
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) throw apiError(400, "validation", "errors.validation");
  if (JSON.stringify(parsed.data.values).length > 30_000) throw apiError(413, "payload_too_large", "errors.validation");
  await ref(workspaceId, draftId).set({
    workspaceId,
    step: parsed.data.step,
    values: parsed.data.values,
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + DRAFT_TTL_MS),
  });
  return { id: draftId, step: parsed.data.step, values: parsed.data.values, updatedAt: new Date().toISOString() };
}

export async function deleteDraft(workspaceId: string, draftId: string) {
  await ref(workspaceId, draftId).delete();
}
