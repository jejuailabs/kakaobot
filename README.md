# Katcha — Liquid Glass 03

공용 카카오톡 봇 계정을 여러 고객의 방에 수동 입장시키고, 방마다 고객이 고른 AI 역할·호출어·프롬프트를 적용하는 멀티테넌트 SaaS.
구현 기준은 `CLAUDE.md` → `docs/01`~`08` 순서이며, 진행 상태는 `docs/08` 진행표에 실제 결과로 기록한다.

> 현재 단계: S1~S7 완료(로그인·챗봇·연결·AI 답변·운영자·배경). 실제 카카오톡 연결(S0/S8)은 Oracle 서버 설치 후 검증한다. 진행표는 `docs/08`.

## 실행 (Windows PowerShell / macOS / Linux 공통)

필요: Node.js 22.12 이상 22.x, npm 10.

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` → `/ko` 로 이동한다.

| 경로 | 내용 |
|---|---|
| `/ko`, `/en`, `/ja` | 랜딩 |
| `/ko/demo` | 로그인 없이 보는 고객 콘솔 demo (DEMO 표시, 이 탭에만 저장) |
| `/ko/demo/admin` | 운영자 화면 demo |
| `/ko/login` | Google 로그인 (Firebase 미설정이면 비활성) |
| `/ko/dashboard` 등 | 실제 콘솔 — S2 전까지는 항상 로그인 화면으로 이동 |

## 스크립트

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run typecheck` | route 타입 생성 + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | 단위 테스트 |
| `npm run test:integration` | 실제 Firestore·OpenAI 통합 테스트 (임시 데이터 생성 후 삭제) |
| `npm run verify` | lint·타입·단위·통합·빌드 — 하나라도 실패하면 중단 |
| `npm run e2e:connection` / `e2e:admin` / `e2e:relay` | 실행 중인 서버 대상 HTTP E2E (`E2E_BASE_URL`) |
| `npm run relay` | Oracle relay (`gateway/README.md`) |
| `npm run assets:backgrounds` | 기본 풍경 배경 webp 재생성 (코드로 생성, 외부 사진 없음) |

## 환경변수

| 이름 | 용도 | Vercel |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Firebase 웹 설정 (공개 가능) | 필요 |
| `NEXT_PUBLIC_APP_URL` | 배포 주소 | 필요 |
| `FIREBASE_ADMIN_CREDENTIALS` | 서비스 계정 JSON(base64) | 필요 |
| `LLM_PROVIDER`, `LLM_PROVIDER_API_KEY` | AI 답변 (openai / gpt-6-luna) | 필요 |
| `OPERATOR_EMAILS` | 운영자 Google 이메일(쉼표 구분) | 필요 |
| `CRON_SECRET` | 매일 만료 데이터 정리 cron 인증 | 필요 |
| `GATEWAY_KEYRING` | relay 서명 키 `{"gw-01":"..."}` | Oracle relay 설치 시 |
| `INTERNAL_JOB_SECRET` | 외부에서 job 재처리 호출 시 | 선택 |
| `IMAGE_PROVIDER_API_KEY` | AI 배경 생성 (미구현, 미설정 표시) | 선택 |
| `FIREBASE_STORAGE_BUCKET` | 기본값 `<projectId>.firebasestorage.app` | 선택 |

`.env.example` 을 `.env.local` 로 복사해 채운다. 비어 있는 기능은 "미설정"으로 표시되고 demo 는 그대로 동작한다.
비밀값은 `NEXT_PUBLIC_` 으로 시작하면 안 되며 git 에 올리지 않는다.

## 구조

```
app/[locale]/(public)    랜딩·로그인·개인정보 안내
app/[locale]/(console)   실제 콘솔 (S2 부터 session 필요)
app/[locale]/demo        demo 콘솔·운영자 화면
components/ui            접근성 primitives (Radix 기반)
components/glass         Liquid Glass 컴포넌트 (GlassShell, StatCard, RoleCard …)
features/*               화면 단위 view (데이터는 ConsoleProvider 로 주입)
lib/shared               공용 타입·Zod schema·호출어·연결코드·마스킹
lib/server               서버 전용 (Firebase Admin 은 여기서만)
messages/{ko,en,ja}.json 번역
```

## 알려진 환경 이슈

- 일부 Windows 환경에서 `@swc/core`(next-intl plugin) 가 `%LOCALAPPDATA%\swc` 캐시 권한 검사에 실패한다.
  `swc-cache-env.ts` 가 프로젝트 내부 캐시(`node_modules/.cache/swc`)를 기본값으로 지정해 우회한다.
- 일본어 글꼴은 번들하지 않고 시스템 글꼴(Hiragino / Yu Gothic / Noto Sans JP)로 표시한다.

## 정직성 원칙

- demo 숫자는 실제 KPI 가 아니며 `/demo` 에만 존재한다.
- 오픈채팅 URL 은 참고 정보이며, 자동 입장·소유 확인을 하지 않는다.
- 실카톡 운영 완료는 Oracle → ReDroid → KakaoTalk → Iris 실제 송수신 검증(S0/S8) 후에만 선언한다.
