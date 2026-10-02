import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// 실제 Firestore(.env.local 의 프로젝트)에 테스트 전용 workspace 로 쓰고 끝나면 지운다.
// 실행: npm run test:integration
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i)] ??= line.slice(i + 1).trim();
    }
  } catch {}
}
loadEnvLocal();

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: { include: ["tests/integration/**/*.test.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 120_000, fileParallelism: false },
});
