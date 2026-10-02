# Katcha — Claude Code 구현 오케스트레이션

## 목표와 확정 결정
공용 카카오톡 봇 계정 하나를 여러 고객의 방에 수동 입장시키고, 방마다 고객이 선택한 AI 역할·호출어·프롬프트를 적용하는 멀티테넌트 SaaS 를 만든다. 프런트는 Vercel 배포, Google 로그인, 한국어·영어·일본어, 다크/라이트 전환을 지원한다. 브랜드 작업명은 Katcha. 첨부 디자인의 **좌측 하단 03 Liquid Glass**만 시각 기준으로 삼는다. 다른 세 시안의 네온·흰 바탕·노란 강조 디자인을 섞지 않는다.

## 필수 읽기 순서
1. docs/01-product-and-scope.md
2. docs/02-liquid-glass-design.md
3. docs/03-screens-and-user-flows.md
4. docs/04-architecture-and-contracts.md
5. docs/05-data-auth-and-isolation.md
6. docs/06-oracle-iris-gateway.md
7. docs/07-ai-runtime-and-operations.md
8. docs/08-delivery-test-and-release.md

## 실행 원칙
- 문서와 실제 저장소를 읽고 구현한다. 기존 코드가 있으면 먼저 상태와 충돌을 확인한다.
- UI 와 mock gateway 는 실환경 검증을 기다리지 않고 구현한다. 실카톡 운영 완료는 Oracle→ ReDroid→ KakaoTalk→ Iris 실제 수신/송신 검증 후에만 선언한다.
- 카카오 공식 일반 단톡방 봇 API 가 있다고 가정하지 않는다. Iris 는 비공식 연동이며 계정·앱·커널 호환성을 고정된 사실로 취급하지 않는다.
- 오픈채팅 URL 입력은 참고 정보다. URL 만으로 입장·소유 확인·room ID 획득을 구현했다고 표시하지 않는다. 운영자가 직접 입장하고, 사용자는 연결 코드를 방에 보내 검증한다.
- 사용자마다 Android 를 생성하지 않는다. bot 정의는 논리적 설정이며 공용 계정 프로필은 방별로 바뀌지 않는다.
- 실제 API 키·Google OAuth·Oracle 계정이 없어도 demo 모드로 모든 화면을 검수할 수 있게 한다. demo 데이터와 실제 데이터를 명확히 구분한다.
- dependencies 는 구현 시 공식 문서 확인 후 호환되는 안정 버전을 lockfile 로 고정한다. 문서의 내부 API 는 프로젝트가 설계한 계약이며 Iris 원본 API 와 구분한다.
- 비밀키를 클라이언트 번들·NEXT_PUBLIC 변수·로그·git 에 넣지 않는다.
- 각 단계 후 관련 검증을 실행하고 결과를 docs/08 의 진행표에 실제 결과로 기록한다. 실행하지 않은 검증은 미실행으로 남긴다.

## 구현 순서와 산출물
S0 환경 확인·gateway 실험 → S1 디자인 shell/demo → S2 Google 인증·DB 격리 → S3 bot CRUD·wizard → S4 연결코드·gateway → S5 비동기 AI·사용량 → S6 회원·수치·로그 어드민 → S7 배경 업로드·AI 생성·일정 → S8 배포·실방 검증 → S9 고도화.
S0 가 막혀도 S1~S3 진행은 가능하다. S4 의 mock 완료를 live 완료로 대신하지 않는다.

## 기본 기술 선택
Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui 기반 접근성 primitives + next-themes + next-intl. Google 로그인은 Firebase Auth, 서버 검증은 Firebase Admin. DB 는 Firestore. 비동기 처리는 Cloudflare Worker + Queues, 중앙 업무 API 는 Next.js 서버 route. Oracle relay 는 Node.js TypeScript 의 상시 프로세스이며 로컬 Iris API 를 감싼다. Firebase 외 다른 인증/DB 를 추가하지 않는다.

## 저장소 목표 구조
app/[locale]/(public), app/[locale]/(console), app/api/v1, components/ui, components/glass, features/bots, features/rooms, features/analytics, lib/server, lib/shared, messages/{ko, en, ja}.json, gateway/, workers/, tests/, docs/, design/.
Firebase Admin 은 lib/server 에서만 사용한다. gateway 와 workers 는 독립 entrypoint 와 배포 설정을 가진다.

## 완료 기준
사용자 A 가 Google 로그인→ 봇 생성→ 연결 코드 발급→ 운영자 수동 입장→ 방에서 코드 전송→ 연결→ 호출어 질문→ 실제 AI 답변을 받는다. 사용자 B 는 A 의 방·설정·이력·연결코드에 접근할 수 없다. 원본 이벤트 중복에도 AI 작업은 하나만 만들어지고, 송신 불명 상태는 자동 무한 재전송하지 않는다. 데스크톱·모바일·두 테마·세 언어에서 핵심 동선이 작동한다.

## Claude Code 시작 지시
“CLAUDE.md 와 docs 를 순서대로 읽고 S0 점검 및 S1 부터 구현하라. 단계별 완료 기준을 검증하고 docs/08 진행표를 갱신하라. 자격증명 없는 부분은 mock 으로 완성하되 live 상태를 꾸미지 말라. UI 는 design/reference.png 좌측 하단 03 의 Liquid Glass 를 docs/02 수치로 구현하라.”

## 추가 확정 범위 — 운영자 모드
회원 검색·상세·정지·한도, 플랫폼 집계 dashboard, 봇 호출 대화 원문/답변 로그와 접근 감사, Liquid Glass 배경 업로드·AI 생성·주기적 생성·선택적 자동 적용·버전 복원을 MVP 범위에 포함한다. docs/05 의 RBAC/보관 정책과 docs/07 의 동작을 준수한다. 배경 생성 API 미설정 시 업로드 기능은 작동하고 AI 생성은 미설정 상태로 표시한다.
