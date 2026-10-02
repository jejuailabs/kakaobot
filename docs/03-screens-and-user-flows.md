# 03. 화면과 UX 흐름

## route map
| URL (locale prefix 포함) | 화면 |
|---|---|
| /ko | 랜딩 |
| /ko/login | Google 로그인 |
| /ko/demo | mock 콘솔, demo 표시 |
| /ko/dashboard | 실제 dashboard |
| /ko/bots | bot 목록 |
| /ko/bots/new | 4 단계 wizard |
| /ko/bots/[id] | 개요·역할·프롬프트·연결·사용량 |
| /ko/rooms | 본인 연결방 |
| /ko/prompts | 본인 프롬프트 버전 |
| /ko/analytics | 날짜별 사용량 |
| /ko/settings | 언어·테마·데이터 설정 |
| /ko/admin | 운영자 전용 |

## Google 로그인
브랜드, '대화에 나만의 AI 를 연결하세요', Google 버튼, 개인정보 안내 링크. 이메일 로그인은 MVP 에서 제공하지 않으므로 시안 속 이메일 버튼을 그대로 만들지 않는다. OAuth 취소는 로그인 화면 유지, 실패는 재시도. 성공 후 server session 을 만들고 원래 의도했던 내부 URL 로 이동한다. 외부 redirect URL 은 차단한다.

## dashboard
인사 + 새 챗봇 만들기 버튼. KPI: 활성 bot/이번 달 처리 메시지/연결 방/답변 성공률. 데이터가 없으면 0 및 안내, 성공률은 표본이 없으면 —. chart 는 최근 7/30 일 선택. 최근 활동은 연결/설정 변경/답변 실패이며 원문 대화는 노출하지 않는다. gateway 장애이면 '카카오톡 연결이 지연되고 있어요' banner 와 마지막 확인 시각. 고객에게 커널·서버 디버그 정보를 보여주지 않는다.

## wizard
1 기본 정보: 이름 2~40 자, 설명 200 자, 방 URL 선택 입력, locale·timezone. URL 은 지원하는 카카오 오픈챗 host 만 검증하며 서버가 자동 방문하지 않는다.
2 역할: AI/FAQ/공지초안/검색/커스텀 다중 카드 선택. 최소 1·최대 3. 기본 AI. 선택 기능별 설명과 필수 입력 제공. FAQ text 최대 12,000 자. custom prompt 최대 8,000 자. 검색 키 미설정이면 설명과 disabled.
3 응답 설정: 기본 호출어 '!AI', startsWith 기준, tone 친근/간결/전문, 길이 짧게/보통/자세히, 지원 모델 목록, 일일 한도. 전체 메시지 자동 응답은 MVP 에서 제공하지 않는다. 테스트 질문 입력과 실제 테스트 버튼(비용·사용량 적용), mock 은 demo badge.
4 검토: 이름·역할·호출어·모델·운영 안내, '챗봇 만들고 방 연결하기'. bot 생성은 draft, 곧바로 연결 안내로 이동. 제출 재시도에도 bot 중복 생성 방지.

뒤로 이동해도 값 유지. local storage 에는 민감한 prompt 대신 임시 draft ID 만 저장하고 서버 draft 를 사용한다. 새로고침 후 draft 복구. unsaved 변경이 있는 편집 페이지에서만 이탈 확인.

## 방 연결
① 봇 입장 요청: URL/방명/관리 권한 동의 제출. 계정 이름과 예상 처리 상태 표시. 오픈채팅은 운영자가 링크로 수동 입장, 일반 방은 지원 여부 검증 후 초대 방식 안내.
② 운영자 입장 확인: pending→ awaiting_code. 공용 계정이 이미 방에 있어도 소유 연결은 별도.
③ 고객 코드 발급: '!연결 ABCD-EFGH' 복사, 만료 10 분, 다시 발급. 코드 공유 금지 안내.
④ 고객이 방에 코드 전송: backend 는 gateway ID+room ID+유효 코드+입장 승인 request 를 원자적으로 매칭.
⑤ connected: 방 표시명·호출어·시험 질문 안내. 대기 poll 은 5 초, 탭 비활성 시 중지, 5 분 후 수동 새로고침. 코드 만료·이미 연결된 방·gateway offline 각각 구체적인 문구.

대시보드에서 모든 미연결 방 목록을 고객에게 보여주지 않는다. 코드가 오기 전에는 운영자만 discovered room 을 본다. 공용 bot 계정을 '누구나 초대 가능'이라고 단정하지 않는다.

## bot 상세
개요/역할 및 답변/프롬프트/방 연결/이력 tab. 상단 active·paused·연결 대기 status, test·pause button. 저장은 명시적, 성공 toast, prompt 변경은 version 기록. pause 는 room routing 즉시 중단하되 방에서 계정을 퇴장시키지 않는다. 삭제는 확인 dialog 후 설정 비활성·개인 데이터 삭제 작업, 공용 계정 방 퇴장은 운영자에게 작업 요청.

## 운영자
입장 요청 queue, 요청자 workspace, URL, 승인/입장완료/거절, gateway heartbeat, failed jobs, unknown deliveries. 운영자 권한은 server claim 으로 검증. 거절 사유는 고객 친화 문구. 코드 검증 후 activate 는 운영자 승인 flag 를 필수로 확인한다.

## 언어와 테마
ko 기본, en/ja 전 번역. language 메뉴는 현재 route·query·draft 를 보존한다. UI locale, AI reply language, 방 timezone 을 별도 필드로 관리한다. theme default system, 사용자가 toggle 하면 light/dark 값 저장; settings 에서 system 재선택. 화면 전체 번역 key 사용, timestamp·number 는 Intl, 차트 label 도 locale 적용. 긴 문구를 ellipsis 만으로 숨기지 말고 tooltip 또는 줄바꿈.

## 공통 상태
목록 empty 는 생성 CTA, loading skeleton, 권한 403 안내,404 bot 없음, 네트워크 실패는 retry, 한도 초과는 reset 시각. 랜딩 demo 와 실제 dashboard 경로를 분리하고 임의 숫자를 운영 화면에 주입하지 않는다.

## 확장된 어드민 화면
/admin 은 전체 KPI 와 기간 chart, /admin/members 는 회원 표·필터·상세 drawer, /admin/conversations 는 대화 목록·원문 상세, /admin/audit 는 감사기록, /admin/appearance 는 배경 에셋·preview·설정·적용·복원이다. /admin/jobs 는 AI/배경 job 실패와 재시도, /admin/gateways 는 연결 상태다. 일반 사용자 sidebar 에는 운영자 메뉴를 보여주지 않는다.
배경 설정의 데스크톱은 에셋 240px/preview 유동/설정 320px 세 영역, 모바일은 배경 목록→ preview→ 설정 세로 stack. sticky footer '미리보기 / 적용하기', 적용 전 변경 범위·테마·버전 확인 dialog. AI 생성은 진행률을 꾸미지 않고 실제 job 상태를 표시한다. 자동 생성 토글 아래 주기·요일/날짜·시간·timezone·월 횟수/예산·자동 적용 토글을 배치한다.
