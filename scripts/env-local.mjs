// .env.local 을 process.env 로 읽는 작은 도우미 (스크립트 전용). 이미 설정된 값은 덮어쓰지 않는다.
import { readFileSync } from "node:fs";
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i)] ??= line.slice(i + 1).trim();
  }
} catch {}
