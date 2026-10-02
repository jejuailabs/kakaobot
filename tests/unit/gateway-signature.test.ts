import { describe, expect, it } from "vitest";
import { parseKeyring, signRequest, verifySignature } from "@/lib/shared/gateway-contract";

const secret = "a".repeat(64);
const body = JSON.stringify({ hello: "world" });

describe("gateway HMAC signature (docs/04)", () => {
  it("정상 서명은 통과", async () => {
    const s = await signRequest(secret, body);
    expect(await verifySignature(secret, body, s)).toEqual({ ok: true });
  });
  it("본문 변조·다른 키·서명 누락은 거절", async () => {
    const s = await signRequest(secret, body);
    expect((await verifySignature(secret, body + " ", s)).ok).toBe(false);
    expect((await verifySignature("b".repeat(64), body, s)).ok).toBe(false);
    expect(await verifySignature(secret, body, { ...s, signature: null })).toEqual({ ok: false, reason: "missing" });
  });
  it("5분 넘는 시간차는 거절", async () => {
    const s = await signRequest(secret, body, Date.now() - 6 * 60_000);
    expect(await verifySignature(secret, body, s)).toEqual({ ok: false, reason: "skew" });
  });
  it("keyring 은 32자 미만 키를 버린다", () => {
    expect(parseKeyring('{"gw-01":"short","gw-02":"' + "x".repeat(32) + '"}')).toEqual({ "gw-02": "x".repeat(32) });
    expect(parseKeyring("not json")).toEqual({});
  });
});
