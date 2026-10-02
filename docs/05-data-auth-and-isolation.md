# 05. 데이터·Google 인증·고객 격리

## 인증
Firebase Google popup, 차단 시 redirect fallback. ID token 을 CSRF token 과 함께 서버에 보내 Firebase Admin 검증 후 Secure/HttpOnly/SameSite=Lax session cookie 를 발급한다. session 최대 5 일. API 마다 session uid 에서 workspace 를 결정한다. 이메일 문자열로 권한을 판정하지 않는다. 로그아웃은 cookie 제거와 client signOut. 정지 회원은 모든 업무 API 에서 거절한다.

## collection 설계
| Collection | 필수 필드 |
|---|---|
| users | uid, displayName, email, locale, theme, status, createdAt, lastLoginAt |
| workspaces | id, ownerUid, limits, status |
| bots | id, workspaceId, name, roles, promptVersionId, modelId, trigger, replyLocale, state, version |
| promptVersions | id, workspaceId, botId, body, faq, version, createdAt |
| joinRequests | id, workspaceId, botId, url, roomLabel, permissionConfirmed, operatorApproved, state |
| pairingTokens | tokenHash, workspaceId, botId, requestId, expiresAt, usedAt |
| roomBindings | gatewayId+roomId unique key, workspaceId, botId, state, loggingPolicy |
| gateways | id, status, lastHeartbeat, adapterVersion, accountLabel |
| events | eventId, gatewayId, roomId, text, receivedAt, expiresAt |
| jobs | eventId, workspaceId, botId, state, leaseUntil, attempt, errorCode |
| deliveries | id, workspaceId, gatewayId, roomId, text, state, leaseUntil, attempt |
| conversationLogs | workspaceId, botId, roomId, pseudonymousSenderId, input, output, model, latencyMs, tokens, status, createdAt, expiresAt |
| usageDaily | workspaceId, date, requests, inputTokens, outputTokens, costMicros, reservedMicros |
| auditLogs | actorUid, actorRole, workspaceId, action, targetId, reason, at |
| backgroundAssets | id, source, storagePath, thumbnailPath, mobilePath, state, prompt, createdBy, createdAt |
| backgroundVersions | id, assetId, theme, scope, overlay, blur, opacity, previousVersionId, createdAt |
| siteAppearance | activeLightVersionId, activeDarkVersionId, version, updatedBy |
| generationJobs | id, prompt, status, costEstimateMicros, attempt, assetId, providerJobId, createdAt |

모든 시각은 UTC 저장, 표시만 timezone 적용. Firestore index 를 코드로 관리한다. room/message ID 는 문자열. 표시명으로 고객을 식별하지 않는다.

## 접근 원칙
업무 데이터의 client Firestore 직접 접근은 금지하고 서버 API 로 제공한다. rules 는 업무 collection deny 가 기본. Admin SDK 는 rules 를 우회하므로 서버 함수에서 ownership 을 반드시 확인한다. client 가 보낸 workspaceId 대신 session 에서 확정한다. bot ID 로 조회 후 workspace 불일치는 404. 목록·분석 query 에 workspace 조건을 넣는다. 내부 이벤트의 고객은 roomBinding 에서만 확정한다. cache·지식검색·이력 key 에도 workspace+bot 을 포함한다.

## 어드민 RBAC
superadmin: 운영자 권한·회원 정지·삭제·한도·배경·로그 접근 관리.
support: 회원 상태/연결/실패 메타 조회, 원문 로그는 별도 permission 필요.
analyst: 집계 대시보드만, 원문·비밀키 불가.
designer: 배경 업로드/생성/미리보기/적용만, 회원·대화 불가.
권한은 server claim 과 서버 role record 에서 확인한다. 프런트 메뉴 숨김만으로 보호하지 않는다. 원문 조회·export·회원 정지·배경 적용은 audit 에 기록한다. admin service account 를 browser 에 제공하지 않는다.

## 원자적 연결
40bit 이상 crypto random code(8 자리 Base32), hash 만 저장, TTL10 분, 재발급 시 이전 code revoke. gateway/room/user 단위 시도 제한. transaction 으로 미사용·만료·입장승인·bot 상태·room 미점유 확인 후 binding 생성+code 사용+bot 활성화를 동시에 commit 한다. 코드는 방에 글을 쓸 수 있다는 증거이며 방장 신분 증명은 아니다. 운영자 승인 없이 활성화하지 않는다.

## 대화 기록 정책
기본은 봇 호출 메시지와 봇 답변만 기록하며 일반 방의 모든 대화를 수집하지 않는다. 방 연결 화면에 기록 범위·AI 전달·보관기간을 안내하고 관리 권한 및 참여자 고지 확인을 받는다. 원문 기본 30 일, 고객이 7/30/90 일 선택 가능하되 운영 정책 상한 적용. 오류 원본 이벤트는 7 일, 감사 이력 180 일, 사용량 집계 365 일 기본. 정확한 운영 정책은 관리자가 설정한다. TTL 은 즉시 삭제 보장이 아니므로 수동 삭제 job 도 제공한다.
원문 보기는 권한과 조회 사유 필수, 기본 마스킹, 열람 행위를 audit. API key·연결 code·비밀번호는 로그에서 제거. export 는 별도 권한·기간/수량 제한·만료 URL·감사 기록. 고객 탈퇴 시 접근 즉시 차단하고 삭제 job 진행 상태 기록. 관리자 임의 장기 보관이 아니라 정책과 고지에 따라 운영한다.

## 배경 파일 보안
Storage 는 public 적용 에셋과 private 생성 draft 를 구분한다. private 는 권한 확인 후 short-lived URL. MIME sniffing, JPEG/PNG/WebP 만 허용, SVG/실행 파일 차단, EXIF 제거,20MB 제한, 디코딩 재인코딩. 원격 URL 가져오기는 MVP 제외하여 SSRF 경로를 만들지 않는다. 공개 배경에는 사람 얼굴·개인정보 없는 풍경을 사용한다.

## 검증
A→ B CRUD/test/pairing/log/export 모두 거절. 가짜 workspaceId·admin claim 거절. 코드 동시소비 1 건, room 동시 claim1 건. designer 의 로그 조회 거절, analyst 의 배경 publish 거절. session 정지 반영, source map/client bundle 비밀키 검사.
