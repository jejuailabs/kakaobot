// next-intl plugin 이 @swc/core 를 로드할 때 기본 캐시(%LOCALAPPDATA%\swc)의 ACL 검사에 막히는 Windows 환경이 있다.
// 프로젝트 내부 캐시를 기본값으로 지정한다. 사용자가 직접 설정한 값은 존중한다.
import { mkdirSync } from "node:fs";
import path from "node:path";

if (!process.env.SWC_NATIVE_BINDING_CACHE) {
  const dir = path.join(process.cwd(), "node_modules", ".cache", "swc");
  mkdirSync(dir, { recursive: true });
  process.env.SWC_NATIVE_BINDING_CACHE = dir;
}
