import { BOT_LIMITS } from "./domain";

export type TriggerMatch =
  | { kind: "none" }
  | { kind: "help" }
  | { kind: "question"; question: string }
  | { kind: "tooLong" };

/** 선두 일치 호출어. 영문은 대소문자 무시, 빈 질문은 도움말 (docs/07). */
export function matchTrigger(text: string, trigger: string): TriggerMatch {
  const body = text.trimStart();
  const head = body.slice(0, trigger.length);
  if (head.toLowerCase() !== trigger.toLowerCase()) return { kind: "none" };
  const rest = body.slice(trigger.length);
  // "!AIabc" 처럼 호출어 뒤에 공백 없이 글자가 붙으면 다른 단어로 본다.
  if (rest.length > 0 && !/^\s/.test(rest)) return { kind: "none" };
  const question = rest.trim();
  if (question === "") return { kind: "help" };
  if (question.length > BOT_LIMITS.questionMax) return { kind: "tooLong" };
  return { kind: "question", question };
}
