# 07. AI·운영·회원 관리·배경 생성

## 메시지 runtime
검증→ event 저장→ queue→ binding→ active bot→ self/system 제외→ 연결 command→ 호출어→ rate/budget reserve→ job claim→ prompt→ LLM→ usage 정산→ conversationLog 와 outbox commit. 미연결 방·paused bot·일반 대화는 LLM 처리하지 않는다.
호출어 기본 '!AI', 선두 일치(영문 case-insensitive). 빈 질문은 도움말, 최대 4,000 자. 이미지 해석은 MVP 미지원. 한 메시지에서 선택 역할을 단일 prompt 로 합성하여 model 을 중복 호출하지 않는다.
provider abstraction 은 generate({model, system, messages, maxOutputTokens, timeoutMs, requestId})→{text, inputTokens, outputTokens, providerRequestId}. allowlist 와 API key 는 서버 관리. 임의 baseURL 입력 금지. 한 provider 실접속을 먼저 완성하고 나머지는 adapter 검증 후 활성화.
prompt 순서: 플랫폼 지시→ 역할/말투→ 버전 고정 custom→ FAQ→ 최근 직접 호출 6 왕복→ 질문. 일반 방 전체 대화를 history 에 넣지 않는다. sender 별 문맥 분리, 검색자료는 untrusted context 로 구분. secret/다른 고객 데이터는 prompt 에 넣지 않는다. 검색 role 은 실제 search API 있을 때만, 공지 role 은 초안 생성만. 카톡 답변 1,200 자/출력 800token 기본, streaming 하지 않는다.

## 비용과 실패
workspace20 회/분, room5 회/분, 일 100 회 기본 제품한도이며 실측으로 조정. 최대입력+출력 예상비용을 transaction reserve, 완료 후실 usage 정산. 불명 provider timeout 은 비용 불명 상태로 reconcile. 재시도는 확정 429/5xx 최대 3 회 1/4/16 초+jitter. unknown 송신 무조건재전송 금지. DLQ, 실패 상세, 운영자 retry 제공. gatewayoffline 작업 TTL5 분. 전체 kill switch+workspace/bot pause 를처리와송신전에확인.

## 어드민 dashboard /admin
GlassShell 을 공유하되 '운영자' badge 와전용 nav. 상단날짜 7/30/90 일, timezone, refresh, CSV 집계 export. KPI: 총회원/기간신규/DAU·MAU/활성 bot/연결방/호출수/성공률/p95 지연/추정 API 비용. DAU·MAU 는로그인또는 bot 관리활동정의로집계하고방참여자수를회원수로세지않는다. 과거기간대비변화, usage 추이, provider 비중, 가입추이, 오류분류, 최근 gateway 상태. 집계 event 기준과 updatedAt 표시. 데이터없음은 0 또는—, 가짜성장수치금지.

## 회원 관리 /admin/members
검색(email/표시명/uid), 상태/가입기간 filter, cursorpagination. 컬럼:회원·가입일·최근접속·bot 수·방수·이번달사용량·비용·상태. detaildrawer 에 workspace/설정/사용량/지원이력. 정지/복원/한도수정/탈퇴처리는 reason 필수와 audit. 회원으로자동로그인하는 impersonation 은 MVP 미포함. 정지시신규 LLM/송신차단, 기존방퇴장은운영요청으로분리.

## 대화로그 /admin/conversations
bot 호출입력+AI 답변기록. 기간/workspace/bot/room/model/status/requestId 필터. 목록엔마스킹요약·시각·상태·지연·token·추정비용. 상세엔원문 쌍·모델·promptVersion·delivery 상태·오류 code. 내부 reasoning/chain-of-thought 는수집하지않는다. 원문 열람 권한+사유확인, export 별도 권한, 각열람/export 감사. 기본 30 일보관,7/30/90 선택과정책상한. 일반 방대화전체수집은제외. CSVexport 는 formula injection 문자(=,+,-,@)를안전하게처리한다.

## 감사이력 /admin/audit
회원상태변경, 권한변경, bot 설정, 방연결/해제, 로그조회/export, 배경생성/적용/복원을기록. actor/action/target/reason/time, 필터와기간 조회. 운영 UI 에서감사기록편집/삭제금지;보관정책에따른자동정리만. 오류 job 관리와감사이력을혼합하지않는다.

## Liquid Glass 배경관리 /admin/appearance
좌측목록(현재/업로드/AI 생성/이전버전), 중앙실시간 GlassShellpreview, 우측설정. 고객 dashboard/landing 별적용범위, light/dark 별 asset 선택. desktop/mobilecrop, overlay 색·불투명도 0~.6, 배경 blur0~8px, 밝기. 유리 panel 의 blur24px 와배경 blur 를별도관리한다. 바꾸는것은 backdropasset 이며카드/문자/기능은유지.
업로드:파일검증→ 재인코딩/EXIF 제거→ thumbnail/mobileasset→ private draft→ preview→ 적용. 검증상태·크기·용량표시. '현재 적용'과 draft 명확히구분. 단일 transaction 으로 appearanceversion 갱신, cacheinvalidating, 실패시이전배경유지. 이력에서'이배경으로복원', 최근 20 버전보존, 사용 중 asset 삭제거절.

## AI 배경생성
어드민'AI 로배경만들기':풍경(산/호수/바다/숲/추상), 색감(청록/라벤더/노을), 테마, 계절, 직접 prompt. 기본 prompt: '고요한 산과 호수, 맑은 구름, 청록과 라벤더, 화면 중앙은 텍스트가 읽히도록 낮은 시각적 복잡도, 사실적인 넓은 풍경, 글자·로고·UI·사람 없이'. landscape 이미지만생성하고 dashboard 전체그림은생성하지않는다.
생성 provider 서버 adapter:submit→ providerJobId→ poll/callback→ asset 처리→ preview. 지원되는실제이미지 API 를구현시공식문서로선정;이문서를작성한 ChatGPT 도구를제품 API 로가정하지않는다. 생성 key 노출금지, 사용량 reserve, jobstatusqueued/generating/processing/ready/failed.동시에 1job, 재시도확정실패 1 회, 불명상태중복생성금지. provider 없으면기능 미설정 표시, 업로드는독립작동.

## 자동 생성 일정
초기에는수동 생성후적용이기본. 설정에서자동 생성 on, 매주/매월, timezone, 최대월생성 4 회, 예산 상한, 실패알림. scheduler 는클라이언트탭이열려있지않아도서버 cron 으로작동, 날짜+scope+scheduleVersionunique key 로중복방지. 기본자동 생성→ 검토대기. 관리자가'자동 적용'도켜면 file 검증/최소해상도/대비검사를통과한배경만활성화. 불합격·생성 실패시기존 배경 유지, 무한 재생성 금지. disabled schedule 도진행중 job 의 publish 를막는다. 생성완료/비용/적용기록 dashboard 에표시.

## 비용모델
Vercel 상용 plan+Oracle/backup+CloudflareWorker/Queues+Firebase/Storage+LLM/search+배경생성 API. 이미지생성비용은대화비용과별도집계/예산. 무료구간은 0 원보장아님. VercelHobby 는개인 비상업용 제한이므로상용공개 plan 확인: https://vercel.com/docs/plans/hobby . RunPod 는 MVP 미사용.

## 후속
파일지식→ 팀→ 결제→ 예약공지→ gateway 분산. 전용계정은별도운영상품. 원문에대한 AI 요약은선택기능으로, 추가 AI 처리와비용을안내한뒤구현한다.
