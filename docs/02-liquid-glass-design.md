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
