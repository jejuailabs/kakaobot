# 08. 구현 단계·검증·배포

| 단계 | 구현 | 완료 증거 |
|---|---|---|
| S0 | Oracle/ReDroid/Kakao/Iris spike | 실제 송수신/재부팅버전기록 |
| S1 | LiquidGlass shell/모든 demo | 두테마세언어 360~1440px |
| S2 | Google/session/workspace/RBAC | 고객격리·운영권한 negative tests |
| S3 | bot CRUD/wizard/prompt | draft 복원·validation·version409 |
| S4 | relay/ingress/queue/연결 | 만료·재사용·동시 claim·mock 왕복 |
| S5 | LLM/budget/log/outbox | 실 API·한도·중복처리 |
| S6 | 회원/수치/로그/audit 어드민 | 권한·집계·마스킹·기록검증 |
| S7 | 배경 upload/AI/scheduler | preview·apply·rollback·중복일정 |
| S8 | 배포/live acceptance | 실방 E2E·복구·운영정지 |
| S9 | 후속기능 | 별도 acceptance 정의후 |

S0 가막혀도 S1~S3, S6~S7mock 은진행. live 완료는 S0/S8 성공필수.

## 테스트
unit:호출어/expiry/비용 reserve/normalize/locale/schedulekey/마스킹.
integration:FirebaseEmulator 에서 A/BCRUD·로그·export 격리, atomicroomclaim, joblease, outboxunique, RBAC, 배경 version 동시 수정, 정지회원처리.
Playwright:랜딩→ wizard→ mock 연결→ 설정, 테마/언어유지, mobilemenu, 회원 관리, 로그필터, uploadpreview/apply/rollback. 실제 Google 인증은테스트환경에서수동검증기록;mock 로그인은 production 금지.
live:테스트방호출→ 답변 1 건, 일반 대화무반응, pause/restart, 동일 event 재전송, selfloop 없음.
장애:429, provider 불명 timeout, gatewayoffline, queue 중복, 송신후 ack 전 crash, 만료 code, 타고객 code, 예산초과, 미인증, 권한 위조. unknown 송신은재전송보류.
배경:잘못된 MIME/SVG/20MB 초과차단, 생성 job 불명중복없음, scheduler 중복 1job, 예산초과차단, 대비불합격시기존유지, 사용 중 asset 삭제차단, 키 client 미노출.

## 환경변수
public: NEXT_PUBLIC_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID, NEXT_PUBLIC_APP_URL.
web secrets: FIREBASE_ADMIN_CREDENTIALS, INTERNAL_JOB_SECRET, GATEWAY_KEYRING, LLM_PROVIDER_API_KEY, IMAGE_PROVIDER_API_KEY, SCHEDULER_SECRET.
worker: INGRESS_GATEWAY_KEYRING, WEB_INTERNAL_JOB_SECRET, WEB_API_BASE_URL;queuebinding EVENTS_QUEUE/EVENTS_DLQ.
relay: GATEWAY_ID, GATEWAY_SIGNING_KEY, INGRESS_URL, WEB_API_BASE_URL, IRIS_BASE_URL(localhost), SQLITE_PATH.
Storagebucket/CORS, OAuthauthorizeddomain, Firestoreindexes/rules/TTL 를 설정. Firebase web API key 와 adminsecret 을구분. .env.example 은 dummy 만. 임의실제 secret 은 git 금지.

## 로컬·배포
dev/build/typecheck/lint/test/test:e2e script, Node/packageversionlock, Emulator/mock/worker 실행 README. WindowsPowerShell 환경설정도기술.
Vercelpreview/prod 분리, Cloudflarequeue/DLQ/secrets, Oraclefirewall+volume+systemd, Storage 접근권한, 서버 scheduler 등록. adb/Iris 공개금지. 생성 cron 은서명검증, 매일 due 일정확인해 idempotentjob 생성. 상용 plan/예산/alert 확인.

## QA
1440×900/1280×800/768×1024/390×844/360×800 두테마. 한국어·영어·일본어, focus/keyboard/ESC, contrast, blurfallback. layout 의실제화면을 reference03 과비교. 최신배경에서도글자대비검사.

## 복구
데이터·Androidvolume·relayDBbackup, webrollback, image digestrollback. DBschema 후방호환. backgroundversion 원자적 rollback. restore 후오래된송신차단 cutoff. 운영 kill switch 실행검증. gateway 업데이트는 test 방→ 일부방→ 전체.

## 진행표
문서작성기준 S0~S8 모두미실행/미구현. S9 범위외. ClaudeCode 는각 stage 마다상태/실행명령/결과/미해결/commit 을실제증거로추가한다. mock 과 live 를분리해보고한다. source 와 secret 접근이없으면무엇이필요한지명시한다.

| 단계 | 상태 | 기록일 |
|---|---|---|
| S0 | **미실행** — Oracle 계정·VM 접근 없음 | 2026-10-02 |
| S1 | **완료 (mock/demo)** | 2026-10-02 |
| S2 | **완료** — 사용자가 배포 사이트에서 Google 로그인 성공 확인 | 2026-10-02 |
| S3 | **완료** — 실제 Firestore CRUD·wizard draft·A/B 격리 통합 테스트 | 2026-10-02 |
| S4 | **mock 완료 / live 미검증** — 입장요청·운영자 승인·연결코드·서명 ingress·원자적 연결. Oracle relay·Cloudflare Queue 미구현 | 2026-10-03 |
| S5 | **완료 (로컬 실 API) / 배포 환경 키 미설정** — gpt-6-luna 실제 답변, 한도·예산·로그·outbox | 2026-10-04 |
| S6 | **완료** — 운영자 현황·회원·대화 로그·감사·실패 작업·게이트웨이 실데이터 | 2026-10-04 |
| S7 | **완료 (업로드·적용·복원·AI 수동 생성) / 자동 생성 일정 미구현** | 2026-10-05 |
| S8 | 미실행 — Oracle·ReDroid·KakaoTalk·Iris 필요 | — |
| S9 | 범위 외 | — |

### S0 — 미실행
- 필요한 것: Oracle Cloud 계정(Always Free A1 가능 여부), SSH 접근, 테스트용 카카오톡 계정·전화 인증(운영자 수동), 테스트 방.
- S1~S3 은 S0 와 무관하게 진행한다. live 상태는 어떤 화면에도 표시하지 않는다(게이트웨이 화면에 "실환경 연동 미검증" 표시).

### S1 — Liquid Glass shell / 전체 demo (2026-10-02)
**구현**
- Next.js 16.3.8 (App Router, Turbopack) + React 19.2 + TypeScript strict + Tailwind 4.3 + Radix(`radix-ui`) + next-themes 0.4.6 + next-intl 4.14.9 + Recharts 3.10 + Zod 4.6. 모든 의존성 exact 버전 + `package-lock.json` 고정.
- 라우트: 랜딩·로그인·개인정보 / `/demo` 고객 콘솔 8화면(대시보드·챗봇 목록·4단계 wizard·상세 5탭·채팅방·프롬프트·분석·설정) / `/demo/admin` 운영자 8화면(현황·입장요청·회원·대화로그·감사·배경·실패작업·게이트웨이). 실제 콘솔 경로(`/dashboard` 등)는 session 이 없으므로 항상 `/login` 으로 307.
- docs/02 component inventory 20종을 `components/glass`, `components/ui` 에 구현. 토큰은 `app/globals.css` CSS 변수(light/dark).
- demo 데이터는 `lib/shared/demo-data.ts`, `demo-admin.ts` 에만 있고 화면에 DEMO badge + 안내 banner 표시. 변경은 sessionStorage(이 탭)에만 저장.
- demo 에서 동작하는 CRUD/상태: 챗봇 생성(Idempotency-Key=draftId 로 중복 생성 방지)·수정(expectedVersion 불일치 시 409 안내)·일시정지/재개·삭제, wizard draft 복구(localStorage 에는 draft ID 만), 입장요청→운영자 입장(시뮬레이션)→코드 발급(40bit Base32, 10분, 재발급 시 이전 코드 폐기)→방 전송(시뮬레이션)→연결, 보관기간 변경, 회원 정지/한도(사유 필수·감사기록), 대화 원문 열람(마스킹 기본·사유 필수·감사기록), 배경 업로드(signature 검사·20MB·1600px)·미리보기·적용·복원.
- 기본 풍경 배경은 `scripts/generate-backgrounds.mjs` 로 코드 생성(외부 사진·라이선스 의존 없음). desktop 22–23KB / mobile 10–11KB webp. 배경 URL 은 manifest(`lib/shared/appearance.ts`) → CSS 변수로 바인딩.
- 폰트: Pretendard·Inter 로컬 self-host. 일본어는 시스템 폰트 fallback (Google Fonts 빌드 다운로드가 Turbopack 에서 실패해 제거).

**실행한 검증과 결과**
| 명령/방법 | 결과 |
|---|---|
| `npx eslint .` | 통과 (0 error, 0 warning) |
| `npm run typecheck` | 통과 |
| `npm test` (Vitest) | 2 files, 15 tests 통과 — 호출어(선두일치·대소문자·도움말·4000자), 연결코드 형식/파싱, 마스킹, CSV formula injection, 오픈채팅 URL host, 역할 1~3·FAQ 필수, 호출어 공백, 외부 redirect 차단, ko/en/ja key·placeholder 일치 |
| `npm run build` | 통과 (101 pages) |
| client bundle 비밀키 이름 검색 / source map | 검출 없음 / client `.map` 없음 |
| 브라우저 수동 확인 (in-app browser) | 1440×900 랜딩 dark·light, 1280×800 demo 대시보드·wizard 전체·연결 흐름 끝까지·운영자 현황(ja)·배경관리(en), 375×812 대시보드, 360×800 랜딩 en/ja — 가로 넘침 없음(scrollWidth=360) |
| `curl` 라우팅 | `/ko/dashboard`·`/en/bots`·`/ko/admin` → 307 `/login`, `/ko/demo` 200, 없는 경로 404, `/` → `/ko` |
| 대비 계산 (worst-case 배경 위 합성) | light: text 12.6, muted 5.7, primary 버튼 5.8, success 5.1, warning 5.4. dark: 초기 토큰에서 muted 3.7·success 3.9 로 미달 → glass-fill .62→.78, card-fill 조정, muted #C8D9E6, success #86EDCB, danger #FFB8C6 로 수정(라벤더 배경 위 muted 4.95, success 5.1) |

**검증 중 발견해 고친 문제**: body 배경이 풍경 레이어를 덮음, 재로드 시 demo 상태가 초기값으로 덮어써짐(저장 effect 순서), ScaledFrame 이 모바일 layout viewport 를 776px 로 넓힘, 생성 직후 항목이 "2분 후"로 표시됨, 사이드바 브랜드 줄바꿈, 기간 토글 줄바꿈.

**미실행 / 미해결**
- 768×1024, 1280×800 을 제외한 일부 해상도의 두 테마 전 화면 캡처 비교, 키보드 전체 순회·스크린리더 점검, Playwright E2E — 미실행.
- 실제 화면 위 자동 대비 측정(axe 등) — 미실행. 위 수치는 토큰 합성 계산값.
- 일본어 글꼴은 시스템 의존이라 Windows/macOS 간 모양 차이 있음.
- git 저장소 아님 → commit 없음 (사용자가 직접 설정 예정).
- S2 진행에 필요: Firebase 프로젝트(웹 config + Admin 서비스 계정), Google OAuth 승인 도메인.

## 시작 지시
CLAUDE.md 를읽고단계별구현하라. 회원 관리/수치/대화로그/감사이력/배경업로드/AI 생성/일정까지포함한다. 배경을사용자가바꿔도 LiquidGlass 디자인이유지되게하라. 준비된실환경검증과테스트만완료로기록하라.

### S2 — Google 인증·session·workspace·RBAC (2026-10-02, 진행 중)
**구현**
- Firebase 프로젝트 `kakaobot-6fea2`. 웹 설정은 `NEXT_PUBLIC_FIREBASE_*`, 서비스 계정은 `FIREBASE_ADMIN_CREDENTIALS`(base64) — 모두 `.env.local`(git 제외).
- 로그인: Google popup → 차단 시 redirect fallback, 창 닫기는 오류로 보지 않음. ID token + double-submit CSRF + Origin 검사 → `POST /api/v1/auth/session` 에서 `verifyIdToken(checkRevoked)`, 5분 이내 로그인·google.com provider 만 허용 → HttpOnly·SameSite=Lax session cookie(5일, production 에서 Secure). `DELETE` 로 로그아웃(쿠키 제거 + client signOut).
- 첫 로그인 시 transaction 으로 `users/{uid}`, `workspaces/ws_{uid}` 생성(기본 한도 bot 3개). workspace 는 항상 session uid 에서 결정.
- `getSessionUser` 는 `verifySessionCookie(checkRevoked)` + users 문서 status 확인. 정지 회원은 콘솔 대신 정지 안내.
- RBAC: Firebase custom claim `roles`(superadmin/support/analyst/designer)로만 판정, 이메일 문자열 사용 안 함. `/admin` 은 권한 없으면 404. 운영자 실데이터는 S6/S7.
- 실제 콘솔은 Firestore 에서 본인 workspace 조건으로만 조회하며 demo 숫자 없음(빈 상태·0·—). 챗봇 생성 등은 S3 전까지 "아직 설정되지 않은 기능"으로 응답.
- Firestore 규칙: 배포된 규칙이 이미 전체 deny 임을 Admin SDK 로 확인, 동일 내용을 `firestore.rules` 로 저장(배포 변경 없음).
- 로컬 네트워크에서 Firestore gRPC 연결이 멈춰 `preferRest: true` 사용.

**실행한 검증과 결과**
| 명령/방법 | 결과 |
|---|---|
| `npm run check:firebase` | Auth OK, Firestore OK(컬렉션 0개) |
| Identity Toolkit 설정 조회 | google.com provider enabled, 승인 도메인: localhost, kakaobot-6fea2.firebaseapp.com, kakaobot-6fea2.web.app, kakaobot-nine.vercel.app |
| `curl` 음성 테스트 | Origin 없음/타 origin → 403, CSRF 없음 → 403, body 오류 → 400, 위조 ID token → 401, 위조 session cookie 로 `/ko/dashboard` → 307 `/login` |
| `npm test` | 3 files, 19 tests 통과 (RBAC 4건 추가: designer 로그 불가, analyst 배경 publish 불가 등) |
| `npm run build`, lint, typecheck | 통과 |
| client bundle 에 서비스 계정 키/이메일 검색 | 검출 없음 |

**미실행 / 미해결**
- 실제 Google 계정 로그인 → 대시보드 진입: 2026-10-02 사용자가 kakaobot-nine.vercel.app 에서 성공 확인.
- Firebase Emulator 기반 A/B 격리 integration test, 정지 회원 API 거절 test: 미실행 (Emulator 미설치, S3 CRUD API 와 함께 작성 예정).
- 운영자 role 부여 도구(custom claim 설정 스크립트): 미구현.
- 서비스 계정 키가 대화창에 노출됨 → 로그인 확인 후 키 재발급(rotate) 권장.

**배포 장애 기록 (2026-10-02)** — Vercel 에서 firebase-admin 을 쓰는 모든 경로가 빈 500.
- 1차(번들 제외 설정)·2차(webpack 빌드) 수정은 원인 확인 없이 적용해 효과 없었음. 이후 임시 진단 route 로 Vercel 에서 직접 확인.
- 원인: firebase-admin 14 → jwks-rsa 4.1.0 이 ESM 전용 jose 6 을 `require()` — Vercel(Node 22.23.2)에서 `ERR_REQUIRE_ESM`. 로컬 Node 는 require(esm) 을 허용해 드러나지 않았음.
- 수정: package.json `overrides` 로 firebase-admin 하위 jwks-rsa 를 3.2.2(jose 4, CommonJS)로 고정. `node --no-experimental-require-module` 로 로컬 재현(수정 전 실패/후 성공) + verifyIdToken·createSessionCookie·verifySessionCookie 통과 확인.
- 배포 확인: 진단 route 전 단계 OK, `DELETE /api/v1/auth/session` 403, 위조 token 401, `/ko/dashboard` → 307 `/login`. 진단 route 삭제 후 404 확인.
- 재발 방지: 배포 관련 수정은 배포된 URL 에서 직접 응답을 확인한 뒤에만 완료로 보고한다. 빌드는 webpack 유지(`next build --webpack`).

### S3 — 챗봇 CRUD·wizard·격리 (2026-10-02)
**구현**: `/api/v1/bots`(GET, POST+Idempotency-Key), `/api/v1/bots/:id`(GET, PATCH+expectedVersion→409, DELETE), `/api/v1/bots/:id/pause`, `/api/v1/drafts/:id`(GET, PUT, DELETE). 공통 `userRoute`: 변경 요청 Origin+CSRF, 검증된 session, 정지 회원 거절, workspace 는 session 에서만. Firestore transaction 으로 생성(workspace 한도·idempotency)·수정(프롬프트 변경 시 버전)·삭제(soft delete + 프롬프트 삭제 + 방 퇴장 ops 요청). 모델은 S5 전까지 "기본 모델 (AI 제공사 연결 후 적용)" 로 표시. 라이트/다크 입력칸 경계 대비 3:1 이상으로 수정(#7A90A2 / #7F9FB8).

| 검증 | 결과 |
|---|---|
| `npm run test:integration` (실제 Firestore, 임시 workspace 후 삭제) | 10 tests 통과 — A 의 봇이 B 목록에 없음, B 의 조회·수정·정지·삭제 404, 동일 key 동시 생성 1건, 다른 workspace 의 같은 key 독립, 버전 불일치 409, 한도 초과 limit, draft 상태 정지 불가, 호출어 공백 validation, draft 격리, 삭제 후 미노출. 남은 테스트 문서 0건 확인 |
| 로컬 브라우저 (테스트 사용자 session, 종료 후 사용자·데이터 삭제) | wizard 입력 → 새로고침 후 서버 draft 복구 → 생성 → 상세(방 연결 탭) → 이름 수정 저장 → 목록 반영 → 삭제 확인 → 빈 목록 |
| 배포 사이트 curl | `GET /api/v1/bots` 401, CSRF 없는 POST 403, 세션 없는 draft PUT 401, CSS 에 입력 경계 토큰 반영 |
| unit / lint / build | 19 tests 통과 / 통과 / 통과 |

**미실행**: 배포 사이트에서 실제 Google 계정으로 챗봇 생성(사용자 확인 필요). Firebase Emulator 는 JDK 21 필요(이 PC JDK 17)로 미사용 — 대신 실제 프로젝트에 임시 workspace 로 통합 테스트.

### S4 — 방 연결 (2026-10-03, mock 완료 · live 미검증)
**구현**
- 고객: 입장 요청(관리 권한·참여자 고지 동의 필수), 연결 코드 발급(운영자 승인 후만, 원문은 응답 1회·서버는 SHA-256 hash, 10분, 재발급 시 이전 폐기, 10분 5회), 방별 보관기간 변경, 연결 대기 5초 poll(탭 비활성 중지, 5분 후 수동).
- 운영자: 입장 요청 queue·입장 완료/거절(`joins.manage`, 사유 필수, auditLogs). 실제 `/admin/join-requests` 화면. 나머지 실제 운영자 화면은 S6/S7 전까지 "준비 중" 안내.
- gateway ingress: `/api/internal/gateways/:gw/events|heartbeat` — gateway 별 HMAC(GATEWAY_KEYRING), 5분 시간차, nonce 1회성(`gatewayNonces`). 이벤트는 eventId 로 저장 후 처리(중복은 duplicate). 자기·일반 대화·미연결·일시정지는 LLM 으로 보내지 않음. 호출어는 `jobs/{eventId}` 1개 생성(S5 에서 처리).
- 원자적 연결 transaction: 미사용·미만료 코드 + 운영자 승인 + bot awaiting_code + 방 미점유 → binding 생성·코드 사용·bot active·연결 안내 outbox. 방 단위 실패 시도 10분 10회 제한.
- 콘솔: 실제 방·입장 요청·heartbeat 기반 gateway 상태(30초 주기, 90초 지연, 180초 오프라인, 없으면 unknown).
- 도구: `node gateway/mock-gateway.ts`(실제 relay 와 같은 계약), `npm run admin:grant -- <email> <role>`, `npm run e2e:connection`.
- 편차: Cloudflare Worker + Queue 대신 web ingress 가 저장 후 동기 처리(MVP). Oracle relay(SQLite inbox/outbox)는 미구현.

**검증**
| 명령/방법 | 결과 |
|---|---|
| `npm test` | 23 tests 통과 (서명: 정상/변조/다른 키/누락/시간차/keyring) |
| `npm run test:integration` | 17 tests 통과 — 승인 전 코드 발급 불가, B 의 A 봇 입장요청 404, **같은 코드 동시 2개 방 → binding 1개**, 연결된 방을 다른 고객 코드로 점유 불가, 만료·잘못된 코드 거절, 중복 이벤트 1회 처리, 일반·자기·미연결 무시, 호출어 job 1개, 일시정지 봇 무시 |
| `npm run e2e:connection` (로컬 dev, 테스트 계정 생성 후 삭제) | 13단계 ALL PASSED — 생성 → 승인 전 코드 409 → 입장요청 → 운영자 queue 노출 → 승인 → 코드 발급 → 서명된 mock 이벤트로 연결 → active → 코드 재사용 거절 → 호출어 job → 잡담 무시 → 연결 안내 outbox 1건 → 위조 서명 401 |
| 배포 사이트 curl | 입장요청·운영자 queue 세션 없이 401, 미서명 gateway 요청 401(unknown_gateway) |

**미실행 / 필요한 것**
- 실제 카카오톡 방 연결(S0/S8): Oracle VM·ReDroid·KakaoTalk·Iris 필요. 배포 환경 gateway 키(`GATEWAY_KEYRING`) Vercel 미설정.
- 운영자 계정 역할 미부여: `npm run admin:grant -- jejuailabs@gmail.com superadmin` 실행 후 재로그인 필요.

### S5 — 비동기 AI·사용량 (2026-10-04)
**결정**: 사용자 선택 `gpt-6-luna` (공식 가격 입력 $0.10 / 캐시 $0.01 / 출력 $0.50 per 1M, 2026-10-03 developers.openai.com 확인). 추론 모델이라 `reasoning.effort: "low"`, `store: false`. 키는 사용자 지시로 00_game_earth 의 OpenAI 키를 `.env.local` 에 복사(프로젝트 전용 키 교체 권장).

**구현**: OpenAI Responses API provider(서버 allowlist, 25초 timeout, 확정 429/5xx 만 1s·4s 재시도, timeout 은 cost_unknown 으로 재시도 없음) · 프롬프트 순서 docs/07 · 로그 저장 전 키·연결코드 제거 · job lease claim · kill switch(`system/flags.killSwitch`) · workspace 20/분, 방 5/분, workspace 일 100, 봇 일일 한도, 월 예산($5 기본) reserve → 정산 · 대화 로그(보관기간 TTL) · outbox(`deliveries`) lease/ack(unknown 자동 재전송 없음) · ingress 응답 후 `after()` 처리 · `/api/internal/jobs/process`(INTERNAL_JOB_SECRET) · 콘솔 테스트 답변(wizard 저장 전 값 포함) · 실제 90일 사용량 차트.

| 검증 | 결과 |
|---|---|
| 실제 gpt-6-luna 호출 (`tests/integration/llm.test.ts`) | 2.7초, 입력 221·출력 64 토큰, 약 $0.000055, 자연스러운 한국어 |
| runtime 통합 (실제 Firestore + LLM) | 같은 job 동시 2회 → 답변 1·skip 1, 로그 1, reserve 0 으로 정산 / 봇 일일 한도 1 초과 → LLM 미호출·한도 안내 / kill switch → 처리 중단 |
| `npm run e2e:connection` | 18단계 ALL PASSED — … 방 `!AI` → job → **실제 AI 답변이 outbox 로 relay 에 전달** → ack sent → 재lease 안 됨 → 대화 로그(3.4초, $0.000075) → 사용량 정산 |
| unit / integration / build | 27 / 22 통과 / 통과. 테스트로 생긴 rateCounters 4건 정리 |
| 배포 사이트 curl | 테스트 답변 세션 없이 401, jobs/process secret 없이 401, 미서명 outbox 401 |

**미실행 / 필요한 것**
- 배포 환경 실제 답변: Vercel 에 `LLM_PROVIDER=openai`, `LLM_PROVIDER_API_KEY` 미설정 → 배포 사이트 테스트 답변은 "설정되지 않음" 응답.
- Cloudflare Queue 대신 `after()` 처리(MVP). 처리 못 한 job 을 주기적으로 다시 처리하는 scheduler 미구현.
- 실제 카카오톡 송수신은 S0/S8.

### S6 — 운영자 실데이터 (2026-10-04)
**구현**: 플랫폼 90일 사용량·DAU/MAU(로그인 기준)·활성 봇·연결 방·p95 지연·월 비용·모델 비중·오류 분류 / 회원 목록(봇·방·이번 달 사용량·비용·상태·일일 한도) / 정지·복원(세션 즉시 무효화, 신규 LLM·송신 차단)·한도 변경 / 대화 로그(목록은 서버에서 마스킹, 원문은 권한+사유로 열람 API 응답에만) / CSV 내보내기(별도 권한, 30일·1,000건, 마스킹, formula injection 방지) / 감사 이력 / 실패 job 재시도·송신 불명 건 수동 재전송 / 게이트웨이 heartbeat. 모든 변경은 사유 필수 + auditLogs. 화면·API 모두 서버 RBAC.

| 검증 | 결과 |
|---|---|
| `npm run e2e:admin` (테스트 계정 4개 생성 후 삭제) | 23단계 → S7 포함 31단계. 3회 연속 ALL PASSED. 역할별 화면 접근(고객 /admin 404, designer 로그 404, analyst 회원 404), 목록 HTML 에 원문 전화번호 없음, analyst 원문 열람·내보내기 불가, 사유 없는 열람 400, 열람·정지·한도 감사 기록, CSV 마스킹·`'=` 무력화, 정지 즉시 기존 세션 401 |
| 첫 실행 간헐 실패 | 코드 변경 직후 첫 실행에서 1~2건(세션 있는 요청이 307/401) 발생, 이후 반복 실행에서는 재현 안 됨. dev 서버 재컴파일 중 요청으로 추정하며 확정하지 못함. 비인증 원인 세션 실패는 서버 로그에 남기도록 변경 |
| 통합 테스트 비결정성 수정 | 동시 연결 테스트의 승자 방을 고정 가정하던 테스트 버그 수정(제품 동작은 정상). 이 실패가 섞인 상태로 커밋 b371075 이 push 됨 → 실패 시 멈추는 `npm run verify` 도입 |

### S7 — 배경 관리 (2026-10-04)
**구현**: 업로드(브라우저 3000px 축소 → 서버 매직바이트 검사·EXIF 방향 반영·메타데이터 제거·desktop 2560/≤700KB, mobile 9:16/≤350KB, thumb/≤60KB 재인코딩, 1600px 미만 거절) → private draft → 미리보기 → 적용(siteAppearance 단일 transaction, expectedVersion 409, 이전 배경 previous, 감사) → 복원 → 사용 중 삭제 거절 → 사이트 문서별 최근 20 버전 유지. root layout 은 태그 캐시된 manifest 를 읽고 적용 시 `revalidateTag` 로 즉시 무효화, 실패 시 내장 배경.
**편차**: Firebase Storage 버킷이 없음(신규 버킷은 Blaze 요금제 필요) → 재인코딩 결과를 Firestore Bytes 로 저장하고 `/api/v1/appearance/files` 로 제공(공개본 immutable 캐시, draft 는 권한자만). 원본 20MB 업로드 대신 브라우저 축소 후 4MB 이내 전송. AI 생성·자동 일정은 `IMAGE_PROVIDER_API_KEY` 미설정으로 "미설정" 응답(업로드는 독립 동작).

| 검증 | 결과 |
|---|---|
| `tests/integration/appearance.test.ts` (운영과 분리된 site 문서) | 3 tests ×2회 통과 — SVG·작은 이미지·손상 파일 거절, EXIF 포함 JPEG → EXIF 없는 webp, 크기 목표 충족, draft 비공개, 적용 → 같은 버전 동시 적용 409 → 두 번째 적용 → 이전 previous 공개 → 사용 중 삭제 거절 → 복원(blur 설정 유지) → 삭제 |
| 운영 데이터 영향 확인 | `siteAppearance/current` 없음(운영 배경 미변경), 테스트 자산·버전 0건 |
| `npm run verify` | lint·types·unit 27·integration 25·build 통과 |
| 배포 사이트 | /ko·/en·/ja·/ko/login·/ko/demo 200, 랜딩 HTML 에 내장 배경 manifest, 업로드 API 세션 없이 401, 없는 배경 파일 404 |

### S4 보완 — Oracle relay 프로그램 (2026-10-04, mock 검증 · 실기기 미검증)
**구현** (`gateway/relay/`, Node 22 내장 `node:sqlite`, 네이티브 의존성 없음): Iris 콜백 수신(127.0.0.1 전용) → 정규화 → self 판별(SELF_SENDER_ID 또는 최근 2분 내 같은 방 같은 문장 송신 journal) → SQLite inbox 선기록(같은 eventId 1회) → 서명 전송, 실패 시 같은 eventId 로 1/2/4/8/30초 backoff+jitter, 4xx 는 dead 보관. outbox 2초 poll → 10분 넘은 송신은 stale 로 거절(복구 cutoff) → journal 선기록 → Iris `/reply` → 결과 ack. 송신 timeout 은 unknown, 송신 중 크래시는 재시작 시 unknown 보고, 둘 다 재전송 안 함. heartbeat 30초. systemd 유닛·설치 안내(`gateway/README.md`).
**미검증**: Iris 콜백 payload 필드 매핑(추정), 실제 `/reply` 동작, Oracle VM·ReDroid 호환성. Cloudflare Worker + Queue 는 미구현(relay → web ingress 직결).

| 검증 | 결과 |
|---|---|
| `npm run e2e:relay` (relay 실제 프로세스 + mock 어댑터 + 실제 web·Firestore·gpt-6-luna) | 9단계 ×2회 ALL PASSED — web 다운 중 수신 이벤트 SQLite 보존 → 재시작 후 같은 eventId 전달·연결, 중복 콜백 1회만 저장, 연결 안내·실제 AI 답변 방 송신, ack sent, 봇 자기 메시지 재유입 ignored_self, 송신 timeout → unknown 보고 → 재전송 없음 |
| unit (`relay-adapter.test.ts`) | 큰 숫자 ID 문자열 유지·sender hash·native ID 없을 때 결정적 eventId·필수값 없으면 폐기 |
| `npm run verify` | unit 30 · integration 25 · build 통과 |

### 2026-10-05 변경 — Storage 전환 · 운영자 이메일 · 자동 정리 · 버그 수정
**사용자 결정**
- 배경 이미지 저장을 Firebase Storage(`kakaobot-6fea2.firebasestorage.app`, asia-northeast3)로 전환. draft 는 비공개 객체(운영자만 `/api/v1/appearance/files` 로 미리보기), 적용 시 객체 공개 + `public, max-age=31536000, immutable` 로 `storage.googleapis.com` URL 제공. Firestore Bytes 저장 제거. Storage 보안 규칙은 이미 전체 deny(클라이언트 SDK 차단) — `storage.rules` 로 저장.
- 운영자 권한: `OPERATOR_EMAILS`(쉼표 구분, 서버 전용 env)에 있는 **Google 로그인 + Google 인증 이메일**을 superadmin 으로 인정. docs/05 "이메일 문자열로 권한을 판정하지 않는다"와 다른 운영 방식이며, 이메일 미인증·다른 provider·유사 도메인은 거부. custom claim(`npm run admin:grant`)도 계속 유효.

**추가 구현**
- 멈춘 AI job 재처리: relay 의 outbox poll(2초)마다 응답 후 1분 넘은 queued·lease 만료 processing job 을 2건씩 처리 (lease 로 중복 처리 방지).
- 만료 데이터 수동 삭제: Vercel Cron 매일 03:00 KST `/api/internal/cron/cleanup` (CRON_SECRET) — 보관기간 지난 대화 로그, 오래된 이벤트·nonce·rate counter·draft·idempotency key·연결 코드.

**버그 수정**
- 간헐적 세션 검증 실패(로그인된 요청이 401/307): 원인은 경로별 모듈 인스턴스가 같은 Firestore 에 `settings()` 를 다시 호출해 나는 `already been initialized` 예외. 앞서 "dev 서버 재컴파일 탓"으로 추정했던 것은 틀렸음. 프로세스 전역 1회 설정으로 수정. 수정 후 admin E2E 3회 연속 통과, 오류 로그 재발 없음.
- relay ack 경로: `/deliveries/:id/ack`(동적 2단계)가 새 dev 서버(Turbopack)에서 404 → `/api/internal/gateways/:gw/ack`(본문에 deliveryId)로 변경. 배포 환경은 기존 경로도 동작했음.

| 검증 | 결과 |
|---|---|
| `tests/integration/appearance.test.ts` (Storage, 분리된 site 문서) | 3 통과 — draft 객체 공개 URL 403, 적용 후 200 + immutable, 나머지 기존 항목 |
| `tests/integration/maintenance.test.ts` | 2 통과 — 만료 로그만 삭제, 1분 넘은 job 만 재처리 |
| unit (`rbac.test.ts`) | OPERATOR_EMAILS: 인증된 Google 이메일만, 미인증·password provider·`…gmail.com.evil.com`·미설정 거부 |
| `npm run verify` | unit 32 · integration 27 · build 통과 |
| E2E (dev) | admin ×3, connection, relay 모두 ALL PASSED. Storage 남은 테스트 객체 0 |

### 2026-10-05 변경 — AI 배경 생성 (OpenAI 이미지, low 품질)
**공식 문서 확인 (2026-10-03, developers.openai.com)**: Image API `v1/images/generations`, 모델 `gpt-image-2.5-flare`(빠른 일상 생성용, 스냅샷 2026-09-08). 가격: 텍스트 입력 $5 / 이미지 출력 $30 per 1M token. 품질별 장당 가격표는 문서에 없어 응답 `usage` 토큰으로 정산.
**구현**: `lib/server/image-gen.ts`(서버 전용 adapter, `LLM_PROVIDER_API_KEY` 사용, 2048×1152·low·webp) → `generateBackground`(lib/server/appearance.ts): requestId = job ID(같은 요청 재전송 시 같은 job), 사이트당 동시 1 job(lock, 5분 넘은 lock 은 불명 실패로 정리), 월 예산 `IMAGE_MONTHLY_BUDGET_USD`(기본 $5)에서 $0.05 예약 → 실제 usage 로 정산, 대화 비용과 별도(`imageUsageMonthly`). 429/5xx 만 1회 재시도, timeout·연결 끊김은 재시도·재생성 없이 예약액을 비용으로 확정. 결과는 업로드와 같은 검증·재인코딩을 거친 **비공개 draft**(source ai, prompt·모델·비용 기록) — 적용은 기존 적용 흐름(사유·감사). 감사: appearance.generate / appearance.generated. prompt 는 서버가 허용 목록(풍경·색감·계절·테마) + 직접 입력 300자로 합성하고, 글자·로고·UI·사람 없음·중앙 저복잡도 조건을 항상 마지막에 붙임. 운영자 화면 AI 카드: 옵션 선택·생성·이번 달 장수/비용/예산·최근 job 상태. demo 는 계속 "미설정"(가짜 생성 없음).
**미구현**: 자동 생성 일정(서버 cron·월 4회·자동 적용·대비 검사) — 화면에서 비활성 + "준비 중" 안내. 배포 환경(Vercel)에 `LLM_PROVIDER_API_KEY` 미설정이면 배포 사이트는 "미설정" 표시.

| 검증 | 결과 |
|---|---|
| 실측 (스크립트 1회) | low 2048×1152 약 11초, 입력 47·출력 157 token ≈ $0.005 |
| `tests/integration/appearance-gen.test.ts` (실제 Firestore·Storage, provider mock, 분리된 site 문서) | 6 통과 — 성공 시 비공개 AI draft·비용 4,945 micros 정산·lock 해제, 같은 requestId 재요청 시 provider 재호출 없음, 5xx 1회 재시도·4xx(moderation) 재시도 없음·비용 0, timeout 은 1회 호출 후 불명 실패·예약액 확정, 진행 중 lock 409·오래된 lock 정리 후 진행, 예산 초과 429(provider 미호출) |
| 같은 파일 실제 provider 테스트 (`LIVE_IMAGE_TEST=1` 일 때만) | 2회 통과 — ready, 비용 5,190 micros, 2048px·133KB |
| 로컬 dev 서버 HTTP (임시 designer 계정, 확인 후 계정·자산 삭제) | 운영자 배경 화면 200·AI 카드 "사용 가능"·모델 표시, 잘못된 옵션 400, 세션 없음 403, 실제 생성 HTTP 200 12.7초 ready($0.00525), 같은 requestId 재요청 0.66초 같은 job, draft 미리보기 운영자 200 / 비로그인 404 |
| `npm run verify` | lint·types·unit 34·integration 33(+live 1 skip)·build 통과 |
| 브라우저 화면 확인 | **미실행** — 같은 폴더에 다른 세션의 dev 서버가 떠 있어 이 세션 브라우저 창에서 열 수 없었음(HTTP 로 렌더 결과만 확인) |
| 운영 데이터 영향 | 실제 생성 확인 1건의 job·월 비용 기록($0.00525)은 실제 지출이라 `backgroundJobs`·`imageUsageMonthly/current_2026-10` 에 남김. 생성 자산은 삭제 |

