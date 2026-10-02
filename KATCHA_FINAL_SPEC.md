# Katcha 최종 통합 구현 명세

3번 Liquid Glass 디자인 · 공용 카톡 봇 SaaS · 어드민/대화로그/AI 배경 관리


---

<!-- source: CLAUDE.md -->

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


---

<!-- source: docs/01-product-and-scope.md -->

# 01. 제품 정의와 범위

## 핵심 가치
별도 서버를 설치하지 않는 일반 사용자가 Google 로그인 후 역할을 골라 자신이 관리하는 카카오톡 방에서 AI 도움을 받는다. 플랫폼 운영자가 공용 카톡 계정과 Oracle gateway 를 관리한다. 고객은 AI 의 역할을 소유하지만 카톡 계정 자체를 소유하지 않는다.

## 사용자 유형
| 유형 | 할 수 있는 일 |
|---|---|
| 비회원 | 제품 소개, demo, Google 로그인 |
| 고객 owner | 본인 bot 생성/편집/일시정지, 연결 신청, 사용량/이력 조회, 데이터 삭제 |
| 운영자 | 입장 요청 처리, gateway 상태, 연결 승인/해제, 장애·사용량 관리 |
| 방 참여자 | 공용 봇에 호출어로 질문, 도움말 확인 |

MVP 는 고객 1 명당 개인 workspace 1 개, bot 3 개까지를 기본 설정값으로 제공한다. 이는 검증용 제품 제한이며 요금 약속이 아니다. 1 bot = 1 연결 방, 1 방 = 활성 bot 1 개로 단순화한다. 여러 역할을 bot 하나에 선택할 수 있지만 매 메시지마다 모델을 여러 번 호출하지 않는다.

## MVP 포함
Google 로그인, bot 목록·wizard·상세 편집, 역할 다중 선택, 호출어, 답변 언어·톤·길이, 모델 선택(설정된 provider 만), 프롬프트 버전, 수동 방 입장 요청, 일회용 코드 연결, 테스트 채팅, 기본 분석, 사용량 제한, 일시정지, gateway 상태, 운영자 대시보드, 세 언어·두 테마·반응형.
역할: AI 질문답변 / FAQ / 공지 초안 / 자료 검색 / 커스텀. FAQ 는 사용자가 입력한 문답을 context 에 포함한다. 자료 검색은 검색 API 가 설정되어야 활성화한다. 공지는 초안 생성 후 사용자가 방에서 요청할 때 응답하며 자동 예약 방송은 후속 범위다.

## 후속 범위
파일 기반 지식 검색, 팀 초대, 구독 결제, 정기 공지, 복수 gateway 분산, 고객 전용 계정. 미구현 항목은 비활성 설명으로 표시하고 작동하는 버튼으로 꾸미지 않는다. MVP 에 자동 오픈챗 입장·자동 계정 생성·고객별 프로필 변경은 없다.

## 연결과 소유 확인의 현실
공개 오픈챗 URL 과 방 이름은 소유 증명이 아니다. 연결코드는 해당 방에서 코드 전송 가능한 사용자인지 확인할 뿐 방장 신분을 증명하지 않는다. 사용자가 관리 권한 보유를 확인하고, 운영자는 입장 요청 때 방 운영자 동의를 확인한 뒤 승인한다. 입장 비밀번호가 필요한 방은 운영자가 별도로 처리하고 공개 로그에 저장하지 않는다.

## 성공 지표
처음 로그인부터 bot 설정 완료까지 3 분 이내 목표. 실제 방 연결 시간은 운영자 처리 대기와 분리해 표시한다. 연결 성공률, 호출어 인식률, 답변 성공률, p95 처리 지연, 중복 이벤트 비율, 고객별 토큰 비용을 실제 수치로 집계한다. 시안의 12,430·96% 등은 실제 KPI 가 아니라 demo 값이다.

## 운영자 기능 추가
회원 관리, 가입/활성/메시지/비용/오류 수치 dashboard, 호출 대화 로그, 감사이력, 배경 업로드·AI 생성·자동 생성 설정을 MVP 에 포함한다. 디자인·지원·분석·최고관리 권한은 분리한다. 자동 적용은 관리자 설정과 품질 검사 후 실행한다.


---

<!-- source: docs/02-liquid-glass-design.md -->

# 02. Liquid Glass 상세 디자인 명세

## 기준 이미지와 해석
원본: design/reference.png. 전체 1672×941 의 2×2 보드이며 03 은 대략 x=0~836, y=470~941 영역이다. 좌측에 Liquid Glass 제목·소개·CTA·로그인 유리 카드, 가운데에 대형 반투명 콘솔, 오른쪽에 스마트폰 채팅 preview 가 겹친다. 산악·호수·구름 배경은 남청색에서 청록·라벤더·복숭아빛으로 연결된다. 숫자와 본문은 작은 시안에서 완전히 판독되지 않으므로 실제 UI 문구는 03 문서의 명확한 문구를 사용한다.

다음 색·치수는 구현을 위한 정규화 토큰이다. 원본에서 측정한 픽셀 값이라는 주장을 하지 않는다. 이미지 속 인사 이름·숫자·사람 얼굴은 demo 데이터로 재현한다.

## 시각 구성
풍경은 화면 가장 아래에 깔고 유리 패널을 3 층까지만 겹친다. 전체를 blur 하지 않고 panel 의 backdrop 만 흐린다. 깊이는 배경→ main glass→ 작은 카드/phone 순으로 만든다. 전체 배경에 검정 덮개를 씌워 풍경을 죽이지 않는다. 업무 화면의 글자는 불투명하고 편집 영역은 읽기 쉬운 surface 를 쓴다. yellow 는 카카오 연동·채팅 말풍선에 한정하며 제품 primary 는 ice-cyan 이다.

## 색상 토큰
| 토큰 | Dark | Light | 용도 |
|---|---|---|---|
| background | #0A2336 | #EAF5FA | 배경 fallback |
| text | #F4FAFF | #163047 | 본문 |
| text-muted | #BDD0DF | #486579 | 보조 문구 |
| primary | #A6E9FF | #136D91 | CTA/활성 |
| primary-foreground | #082D42 | #FFFFFF | CTA 문자 |
| accent | #BDAFFF | #7764C5 | 그래프/선택 |
| success | #77E7C1 | #13785D | 정상 |
| warning | #FFD98A | #8A5C0D | 대기 |
| danger | #FF9BAF | #AD3154 | 오류 |
| glass-fill | rgba(30,73,103,.62) | rgba(255,255,255,.72) | 대형 유리 |
| card-fill | rgba(80,122,152,.32) | rgba(255,255,255,.82) | 내부 카드 |
| glass-border | rgba(223,245,255,.35) | rgba(255,255,255,.88) | 테두리 |
| input-fill | rgba(9,36,56,.78) | rgba(255,255,255,.94) | 폼 대비 |
| kakao | #FEE500 | #FEE500 | 연결용 강조 |

본문 4.5:1, 큰 글자·UI 경계 3:1 을 실제 배경 위에서 측정한다. 위 조합은 출발점이며 contrast 검사로 불투명도를 조정한다. 상태는 색과 텍스트·아이콘을 함께 사용한다.

## 유리 재질
main panel: border 1px solid var(--glass-border), radius 28px, backdrop-filter blur(24px) saturate(135%), shadow 0 24px 64px rgba(3,20,38,.24). 위쪽과 왼쪽에만 1px 의 밝은 inset 선을 둔다. 작은 card: radius 18px, blur 12px, shadow 0 8px 24px rgba(4,28,44,.12). selected card 는 primary 1px outline + rgba(166,233,255,.08) fill. glow 는 hover/selected 에서만, 최대 16px 확산·20% 불투명도. 모든 컨트롤에 glow 를 주지 않는다.
CSS backdrop-filter 미지원 및 모바일 성능 모드는 dark #173D56 / light #F4F9FC 불투명 surface 로 fallback 한다. glass 는 스타일일 뿐 가독성보다 우선하지 않는다.

## 배경 에셋
landscape.webp 2560px wide, 모바일 landscape-mobile.webp 1080px, AVIF 옵션. 호수는 하단 35%, 능선은 중간 40%, 맑은 구름은 위 25%. 배경 초점 desktop 50% 55%, mobile 40% 50%. 정식 배포에는 라이선스 확인된 사진이나 별도 생성 에셋 사용. 원본 보드를 통째로 CSS 배경에 써 UI 를 겹쳐 그리지 않는다. 콘솔 배경은 고정된 한 장 + gradient overlay; LCP 에셋을 preload 하고 desktop 목표 700KB 이하, mobile 350KB 이하. 애니메이션 배경 영상은 MVP 에 넣지 않는다.

## 타이포그래피
Korean: Pretendard 로컬 woff2; Latin: Inter; hero 제목만 Georgia/serif fallback 또는 라이선스 확인된 display serif. 일본어는 Noto Sans JP fallback. headline 64/68px desktop, 44/48 tablet, 34/40 mobile. 콘솔 page heading 24/32 weight 650, section 18/26 weight 600, body 14/22, label 13/20, caption 12/18, KPI 28/34 tabular-nums. 장문 영문은 uppercase 로 강제하지 않는다. 히어로 외에는 serif 를 쓰지 않는다.

## spacing 와 규격
기준 4px: 4,8,12,16,20,24,32,40,48,64. viewport 1440 에서 container 1280, 좌우 padding 40. header 높이 72. 콘솔 외곽 margin 24, sidebar width 216, 내부 gap 24, 카드 padding 20. compact desktop 1024~1279: sidebar 184, content padding 20. 버튼 44px 높이/12px radius, 큰 CTA 48px, icon button 40px(터치 hit area 44). input 44px, textarea 최소 144px, select trigger 44px. modal 640px, editor drawer 480px. tooltip 은 불투명 surface.

## 히어로 구성
1360px 이상에서는 좌측 설명 28%, 중앙 콘솔 57%, 우측 phone 15%를 기준으로 overlap 최대 56px. 콘솔은 760×520 비율, phone 은 216×432 비율의 제품 자체 mock chat. hero height min(820px, viewport)에 가까우나 콘텐츠를 자르지 않는다. 제목 '일상의 대화에, 나만의 AI 를.' 서브 '역할을 고르고 카카오톡 방에 연결하세요.' primary 'Google 로 시작하기', secondary '데모 둘러보기'. 하단 4 개 기능: 만들기/연결하기/맞춤 설정/성장하기. 시안의 과도하게 작은 글자를 웹에서도 유지하지 않는다.

## 콘솔 구성
좌측 브랜드·sidebar → 상단 인사·테마/언어/계정 → KPI 4 개 → 복합 bar/line chart → 최근 연결방 60% + 설정 preview 40%. 차트 lavender line 과 ice-cyan bar, 수평 grid 8% white. KPI 카드 1:1.1 비율, 강조색은 아이콘 작은 면적만. 최근 방 row 56px, avatar 32px, 오른쪽 status pill. settings preview 에는 호출 조건 설명과 CTA 를 제공한다. 실제 편집은 전용 화면에서 저장한다.

## 모바일
<768px 는 sidebar 를 sheet 로 전환, content padding16, KPI 2×2, chart 가로 스크롤 없이 축 수 줄이기, 아래 카드 세로 stack. 히어로는 설명→ 콘솔 preview→ CTA 보조 순서이며 phone 은 탭으로 전환해 겹침 제거. dialog 는 full-width bottom sheet 또는 full-screen 100dvh, sticky action footer. 360px 에서도 가로 넘침 없다. 폼 label 은 placeholder 와 분리한다.

## motion·접근성
hover translateY(-2px) 160ms, sheet 220ms, chart 최초 400ms 이하, 지속 움직임 없음. prefers-reduced-motion 에서는 transform animation 제거. focus-visible 2px primary outline + 3px offset. 모든 menu/dialog 는 keyboard·ESC·focus trap·닫힌 뒤 원래 trigger 복귀. 테마 전환에 번쩍임이 없도록 초기 theme script 를 사용한다. aria-live 는 저장·연결 상태에만 polite 로 사용한다. icon-only 컨트롤은 번역된 aria-label 을 제공한다.

## 반드시 구현할 component inventory
GlassShell, GlassSidebar, GlassHeader, GlassCard, StatCard, RoleCard, StatusPill, GlassInput, ThemeToggle, LocaleMenu, UsageChart, BotCard, RoomRow, ConnectionStepper, PairingCodeCard, ChatPreview, ConfirmDialog, EmptyState, Skeleton, ErrorBanner. 각 component 에 default/hover/focus/disabled/loading/error 를 정의한다. disabled 는 클릭 가능하지 않으며 로딩 버튼은 중복 submit 을 막는다.

## 화면 QA
1440×900,1280×800,768×1024,390×844,360×800 두 테마 캡처. glass 두께·선명한 문자·풍경 초점·카드 간격을 원본 03 과 비교한다. 모바일 blur 성능, 한글 긴 이름·영문 긴 버튼·일본어 줄바꿈을 검수한다. 디자인 구현 완료는 빈 껍데기 아닌 CRUD 와 상태가 연결된 화면 기준이다.

## 배경 교체에 대응하는 디자인
background image URL 을 component 에 하드코딩하지 않는다. 서버 siteAppearance 의 버전별 manifest 에서 desktop/mobile asset 과 overlay 를 읽고 CSS 변수에 바인딩한다. 기본 fallback gradient 는 항상 존재한다. 이미지 로딩 실패 시 직전 검증된 asset 또는 fallback 을 쓴다. 배경 교체는 cards 의 불투명도·contrast 를 재평가하고 text 색을 임의 추출색으로 바꾸지 않는다. 어드민 preview 는 동일 GlassShell 컴포넌트로 desktop/mobile 과 light/dark 를 전환한다. preview 상태는 실제 publish 전 고객 화면에 영향 없다.


---

<!-- source: docs/03-screens-and-user-flows.md -->

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


---

<!-- source: docs/04-architecture-and-contracts.md -->

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


---

<!-- source: docs/05-data-auth-and-isolation.md -->

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


---

<!-- source: docs/06-oracle-iris-gateway.md -->

# 06. Oracle·ReDroid·Iris gateway

## 먼저 실환경 검증
Oracle 무료 VM 에서 카톡이 정상 작동하는 조합은 아직 검증하지 않았다. Iris 는 root Android DB 연동 도구이며 ReDroid 는 host kernel 기능에 의존한다. 무료 VM 확보, 현재 무료 조건, OS/kernel/architecture, Android image digest, KakaoTalk/Iris 버전을 실제 설치 결과로 기록한다.

## S0 순서
1 Always Free eligible VM 확보 가능 여부 확인. 유료 resource 는 비용을 먼저 구체화한다.
2 binder/binderfs 지원 확인. ashmem 은 image 별 요구 확인; 최신 kernel 은 memfd 대체 검토. 오래된 quickstart 를 그대로 보장하지 않는다.
3 Docker→ 검증한 ReDroid version/digest 고정→/data 영속 volume.
4 adb 127.0.0.1:5555, SSH tunnel+scrcpy 로 접속. Iris3000 도 외부 공개 금지.
5 정상 배포 KakaoTalk 설치, 운영자가 전화인증/로그인 수동 처리. 인증 우회 구현 없음.
6 Iris 공식 release/control script 로 root 구동, 실제 event 설정 확인.
7 테스트방 수신 payload 관찰→ adapter→ 실제 reply 전송.
8 재부팅 후 session 유지,24 시간 수신, 네트워크 재연결 시험.

## 실제 Iris 와 내부 계약 구분
확인된 로컬 reply 는 POST /reply {type:'text', room:'문자열', data:'문자열'}. Iris /query 는 고객에게 제공하지 않는다. event payload 와 hook 방식은 설치 release 에서 관찰한다. 존재하지 않는 자동 join API 를 가정하지 않는다.

## relay
localhost callback→ SQLite durable inbox→ 서명→ Worker. 실패는 같은 event ID 유지,1/2/4/8/30 초 backoff+jitter. durable outbox 는 2 초 poll, lease 된 건만 실행. systemd restart-on-failure, heartbeat30 초,90 초 degraded/180 초 offline. Android volume 과 relay DB 를 별도로 backup.
송신 전에 local journal 기록, Iris 성공 후 ack. 송신 timeout 으로 성공 여부 불명하면 unknown 으로 보류하고 무조건 재송신하지 않는다. self event 는 계정 ID+송신 journal 로 제거. restore 때 오래된 outbox 를 재송신하지 않도록 cutoff 유지.

## 수동 입장
고객 신청→ 운영자 관리권한 동의 확인→ 직접 입장→ 승인→ 고객 code→ binding. 계정 제한·방 제한·로그인 실패는 실제 오류로 보고한다. 일반 단톡과 오픈챗은 각각 시험하고 가능 확인된 유형만 UI 에 제공한다. 공용 계정은 방마다 이름·프로필이 달라지지 않는다.

## 무료 운영 조건
2026-10-02 참조 Oracle 공식 문서는 A1 총 2OCPU/12GB 와 유휴 인스턴스 회수 조건을 표시한다. 과거 4OCPU/24GB 를 고정 전제로 삼지 말고 실제 계정 조건을 확인한다. 무료는 가용성 보장이 아니다. 가짜 부하로 회수를 회피하지 않고 backup·재생성·유료 이전 계획을 둔다. 단일 계정 100 고객 같은 수용량은 보장하지 않는다. 실제 RAM/지연/방 수를 측정한다.

## 실패 대응
S0 가 실패해도 UI·mock 구현은 계속한다. live 제공은 중지하고 다른 Linux VM 또는 root Android 실기기 adapter 로 검증한다. 실패와 비용 변경을 docs/08 에 기록한다.

## 출처
https://github.com/dolidolih/Iris
https://github.com/remote-android/redroid-doc
https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
Iris 의 복수 license 적용 범위는 배포 소스/release 에서 확인하고 변경 배포 시 준수 사항을 기록한다.


---

<!-- source: docs/07-ai-runtime-and-operations.md -->

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


---

<!-- source: docs/08-delivery-test-and-release.md -->

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

## 시작 지시
CLAUDE.md 를읽고단계별구현하라. 회원 관리/수치/대화로그/감사이력/배경업로드/AI 생성/일정까지포함한다. 배경을사용자가바꿔도 LiquidGlass 디자인이유지되게하라. 준비된실환경검증과테스트만완료로기록하라.
