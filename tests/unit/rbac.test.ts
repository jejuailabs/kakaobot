import { describe, expect, it } from "vitest";
import { can } from "@/lib/shared/rbac";

describe("RBAC (docs/05)", () => {
  it("designer 는 대화 로그를 볼 수 없다", () => {
    expect(can(["designer"], "conversations.view")).toBe(false);
    expect(can(["designer"], "appearance.manage")).toBe(true);
  });
  it("analyst 는 배경 적용·원문 열람 불가, 집계만", () => {
    expect(can(["analyst"], "appearance.manage")).toBe(false);
    expect(can(["analyst"], "conversations.reveal")).toBe(false);
    expect(can(["analyst"], "metrics.view")).toBe(true);
  });
  it("support 는 원문 열람이 기본 권한에 없다", () => {
    expect(can(["support"], "conversations.view")).toBe(true);
    expect(can(["support"], "conversations.reveal")).toBe(false);
  });
  it("권한 없는 일반 고객은 운영자 화면 불가", () => {
    expect(can([], "admin.view")).toBe(false);
  });
});
