import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import ko from "@/messages/ko.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
function placeholders(s: string) {
  return [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}
function get(obj: unknown, path: string): string {
  return path.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)[k], obj) as string;
}

describe("messages", () => {
  const base = keys(ko).sort();
  it.each([["en", en], ["ja", ja]])("%s 는 ko 와 같은 key 를 가진다", (_, m) => {
    expect(keys(m).sort()).toEqual(base);
  });
  it.each([["en", en], ["ja", ja]])("%s placeholder 가 ko 와 일치한다", (_, m) => {
    for (const k of base) expect([k, placeholders(get(m, k))]).toEqual([k, placeholders(get(ko, k))]);
  });
});
