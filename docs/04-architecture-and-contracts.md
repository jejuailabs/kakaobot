# 04. 시스템 구조와 내부 API 계약

## 책임 분리
Vercel: Next.js UI, session 검증, bot CRUD, workspace DB 접근, AI job 수행 API.
Firebase: Google Auth, Firestore durable data, optional Storage(후속).
Cloudflare: signed gateway ingress + Queues consumer. Queue 는 메시지 발생 때만 처리한다.
Oracle: ReDroid+KakaoTalk+Iris, localhost relay, SQLite durable inbox/outbox, outbound delivery poll, heartbeat. Android 실행층만 상시 유지한다.
LLM: 외부 provider API. 자체 GPU·RunPod 는 MVP 에 필요 없다.

메시지 흐름: Iris event→ Oracle relay normalize/sign→ Worker ingress→ Queue→ authenticated Vercel runtime job→ DB outbox→ Oracle poll→ localhost Iris /reply. Vercel 에서 공용 인터넷의 Iris 로 직접 접근하지 않는다. ingress API 성공은 queue 저장 성공 시에만 응답한다. relay 는 응답 못 받으면 동일 event ID 로 재시도한다.

## 서비스 트리
web/, gateway/, workers/를 별도 패키지로 두거나 root web + gateway + workers 로 구성한다. 공통 Zod schema 는 packages/contracts 에 두고 빌드에서 재사용. local 은 mock gateway 가 같은 계약으로 event 를 보낸다.

## 인증 경계
browser→ web: HTTPOnly Firebase session + CSRF 방어.
relay→ Worker: gateway 별 HMAC-SHA256, timestamp, nonce, body hash. 시간차 5 분 초과 거절, nonce replay cache 저장.
Worker→ web internal job: 별도 service secret 및 job ID. 사용자 session 으로 internal endpoint 호출 불가.
relay→ web outbound/heartbeat: gateway 별 key 로 서명. 응답 outbox 도 gateway ID scope.
각 키는 별도 secret, 회전 가능. TLS 필수, Iris API 는 loopback 만.

## 정규화 이벤트 (프로젝트 내부 규격)
```json
{"schemaVersion":1,"eventId":"gw-01:stable-message-id","gatewayId":"gw-01","roomId":"1234567890123456789","senderId":"hashed-or-local-id","messageId":"stable-message-id","text":"!AI 제주 날씨 알려줘","receivedAt":"2026-10-02T10:00:00Z","isSelf":false,"kind":"text"}
```
roomId/messageId 는 문자열; JS number 로 변환하지 않는다. 원본 Iris event shape 는 설치한 release 에서 관찰하고 adapter 로 변환한다. 실제 native 안정 ID 가 없으면 room/sender/native timestamp/raw payload 기반의 충돌 검토된 hash 를 생성하고 이 한계를 기록한다.

## public API
| Method/path | 목적 | 제약 |
|---|---|---|
| GET/POST /api/v1/bots | 본인 목록/생성 | server workspace 강제 |
| GET/PATCH/DELETE /api/v1/bots/:id | 상세/수정/삭제 | owner 확인 |
| POST /api/v1/bots/:id/test | 테스트 답변 | rate·budget 적용 |
| POST /api/v1/bots/:id/join-request | 입장 요청 | bot owner |
| POST /api/v1/bots/:id/pairing-token | 코드 발급 | 승인 상태 |
| GET /api/v1/bots/:id/connection | 연결 상태 | 본인 scope |
| POST /api/v1/bots/:id/pause | 활성 변경 | version 확인 |
| GET /api/v1/usage | 기간별 분석 | 기간 최대 90 일 |
| POST /api/v1/auth/session | ID token→ session | Origin/CSRF |
| DELETE /api/v1/auth/session | logout | cookie 제거 |

PATCH 에는 expectedVersion 을 보내 충돌 409. POST 생성은 Idempotency-Key 를 workspace scope 로 저장. cursor pagination 기본 20 최대 100. 오류 envelope: {error:{code, messageKey, requestId, fieldErrors?}}. stacktrace 는 고객에게 반환하지 않는다.

## internal API
POST /api/internal/jobs/process 는 eventId 를 받아 idempotent processing.
GET /api/internal/gateways/:id/outbox 는 lease 가능한 delivery 최대 10 개 반환.
POST /api/internal/gateways/:id/deliveries/:id/ack 는 sent/failed/unknown 결과.
POST /api/internal/gateways/:id/heartbeat 는 status 및 observed version.
queue payload 는 eventId 와 gatewayId 위주이며 원문은 보호된 DB 에 둔다. ingress 가 원문 저장 API 성공을 확인한 뒤 queue 에 enqueue 한다. 저장 후 queue 실패 시 같은 eventId 를 다시 enqueue 가능하고 job claim 이 중복을 막는다.

## durable processing
이벤트 stored→ queued→ processing(lease)→ completed/failed/ignored. Firestore transaction 으로 claim, 만료 lease 회수. AI 결과와 outbox 생성은 동일 transaction 으로 commit. Queue delivery 는 at-least-once 이며 exactly-once 라고 표현하지 않는다. event unique key 와 outbox unique key 가 중복 업무를 줄인다. 모델 호출 중 crash 는 비용 중복 가능하므로 cost reserve 와 처리 한도 적용.

## 어드민 API (모두 서버 RBAC)
GET /api/v1/admin/metrics, GET /members, GET/PATCH /members/:uid, GET /conversations, POST /conversations/:id/reveal, POST /conversations/export, GET /audit, GET /appearance, POST /appearance/uploads, POST /appearance/generate, GET /appearance/jobs/:id, POST /appearance/publish, POST /appearance/rollback, GET/PATCH /appearance/schedule. 이 경로들은 /api/v1/admin prefix 를 공유한다. publish/rollback 은 expectedVersion 과 auditreason 을 요구한다. 생성 endpoint 는 idempotency key 와예산 reserve. upload 는서명된 URL 발급→ 완료확인→ 파일처리 job→ draft 생성. generation/scheduler 는별도 durablejob 이며카톡 eventqueue 와구분한다.
