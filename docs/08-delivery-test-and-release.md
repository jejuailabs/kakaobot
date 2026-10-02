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
| S5~S8 | 미구현 | — |
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
