import { describe, expect, it } from "vitest";
import { can, isOperatorEmail } from "@/lib/shared/rbac";

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

describe("OPERATOR_EMAILS", () => {
  const raw = " Jejuailabs@gmail.com , other@x.com ";
  it("목록에 있는 Google 인증 이메일만 운영자", () => {
    expect(isOperatorEmail("jejuailabs@gmail.com", true, "google.com", raw)).toBe(true);
    expect(isOperatorEmail("OTHER@x.com", true, "google.com", raw)).toBe(true);
  });
  it("미인증 이메일·다른 provider·목록 밖·미설정은 거부", () => {
    expect(isOperatorEmail("jejuailabs@gmail.com", false, "google.com", raw)).toBe(false);
    expect(isOperatorEmail("jejuailabs@gmail.com", true, "password", raw)).toBe(false);
    expect(isOperatorEmail("jejuailabs@gmail.com.evil.com", true, "google.com", raw)).toBe(false);
    expect(isOperatorEmail("jejuailabs@gmail.com", true, "google.com", "")).toBe(false);
  });
});
