import { describe, expect, it } from "vitest";
import { irisAdapter } from "../../gateway/relay/adapters.ts";

// ⚠ Iris 실제 payload 는 미검증. 이 테스트는 "어떤 형태든 안전하게 정규화한다"는 규칙만 고정한다.
const a = irisAdapter("http://127.0.0.1:3000");

describe("iris adapter normalize", () => {
  it("큰 숫자 room/message ID 를 문자열로 유지하고 sender 는 hash 로 바꾼다", () => {
    const ev = a.normalize({ msg: "!AI 안녕", json: { _id: "9007199254740993", chat_id: "18234567890123456789", user_id: "4242", created_at: 1790000000 } }, "gw-01");
    expect(ev?.roomId).toBe("18234567890123456789");
    expect(ev?.messageId).toBe("9007199254740993");
    expect(ev?.eventId).toBe("gw-01:9007199254740993");
    expect(ev?.senderId).not.toContain("4242");
    expect(ev?.receivedAt).toBe(new Date(1790000000 * 1000).toISOString());
  });
  it("native ID 가 없으면 같은 메시지는 같은 eventId (재전송 중복 제거)", () => {
    const raw = { msg: "!AI 질문", room_id: "77", sender: "u1", created_at: 1790000001 };
    expect(a.normalize(raw, "gw-01")?.eventId).toBe(a.normalize(raw, "gw-01")?.eventId);
    expect(a.normalize({ ...raw, msg: "다른 말" }, "gw-01")?.eventId).not.toBe(a.normalize(raw, "gw-01")?.eventId);
  });
  it("room·sender 가 없으면 버린다", () => {
    expect(a.normalize({ msg: "hi" }, "gw-01")).toBeNull();
    expect(a.normalize(null, "gw-01")).toBeNull();
  });
});
