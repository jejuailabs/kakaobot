// 연결 코드: 8 자리 Base32 (40bit) crypto random. 서버는 hash 만 저장한다 (docs/05).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32자, 0/O/1/I 제외

export function generatePairingCode(): string {
  const bytes = new Uint8Array(5); // 40bit
  crypto.getRandomValues(bytes);
  // 40bit 는 Number 의 정수 정밀도(53bit) 안이므로 곱셈/나눗셈으로 다룬다.
  let bits = 0;
  for (const b of bytes) bits = bits * 256 + b;
  let out = "";
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[bits % 32] + out;
    bits = Math.floor(bits / 32);
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export const PAIRING_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** 방 메시지에서 "!연결 ABCD-EFGH" 명령을 찾는다. */
export function parseConnectCommand(text: string): string | null {
  const m = text.trim().match(/^!(?:연결|connect|接続)\s+([A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/i);
  if (!m) return null;
  const code = m[1].toUpperCase();
  return PAIRING_CODE_PATTERN.test(code) ? code : null;
}
