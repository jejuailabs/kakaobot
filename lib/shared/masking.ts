// 로그 표시·export 용 마스킹 유틸 (docs/05, docs/07).

/** 원문 마스킹: 휴대전화 가운데 자리, 이메일, 6자리 이상 숫자열 */
export function maskText(s: string): string {
  return s
    .replace(/\b(01[016789])-?(\d{3,4})-?(\d{4})\b/g, "$1-****-$3")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "•••@•••")
    .replace(/\d{6,}/g, (m) => "•".repeat(m.length));
}

/** 목록 표시용 요약: 앞부분만, 마스킹 적용 */
export function maskedSummary(s: string, n = 18): string {
  const m = maskText(s);
  return m.length > n ? `${m.slice(0, n)}…` : m;
}

/** CSV formula injection 방지: =,+,-,@,tab,CR 로 시작하는 셀은 작은따옴표로 무력화 */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
