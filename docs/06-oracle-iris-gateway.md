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
