# gateway — Oracle relay

카카오톡(ReDroid 안의 KakaoTalk + Iris)과 Katcha 웹 서버 사이를 중계하는 상시 프로세스다. 설계는 `docs/06`.

```
Iris 콜백 ──▶ relay(127.0.0.1:8790) ──▶ SQLite inbox ──▶ 서명 POST /api/internal/gateways/:gw/events
                                   ◀── 2초 poll  POST /api/internal/gateways/:gw/outbox
              journal 기록 ──▶ Iris POST /reply ──▶ ack (sent | failed | unknown)
              30초 heartbeat ──▶ POST /api/internal/gateways/:gw/heartbeat
```

## 현재 상태 (2026-10-04)

| 항목 | 상태 |
|---|---|
| relay 프로그램 (SQLite inbox/journal, 서명, backoff, outbox, ack, heartbeat, self 필터, cutoff) | 구현 · mock 어댑터로 E2E 통과 (`npm run e2e:relay`) |
| Iris 어댑터 `/reply` 송신 | 구현 (docs/06 에 확인된 형식) · **실기기 미검증** |
| Iris 콜백 payload → 정규화 매핑 | **추정 매핑 · 미검증** — 설치한 Iris release 의 실제 payload 를 보고 `adapters.ts` 를 고쳐야 한다 |
| Oracle VM · ReDroid · KakaoTalk · Iris 설치 (S0) | 미실행 |
| Cloudflare Worker + Queue | 미구현 — 지금은 relay 가 web ingress 로 직접 보낸다 |

## 로컬에서 확인

```bash
npm run e2e:relay
```

mock 어댑터로 relay 를 띄워 연결 코드 → 실제 AI 답변 송신, 웹 장애 중 수신 보존, 송신 불명 미재전송, 자기 메시지 무시를 확인한다.

## Oracle VM 설치 순서 (S0 — 실제 결과를 docs/08 에 기록)

1. Always Free A1 VM 확보 가능 여부 확인. 무료 조건은 계정·리전마다 다르다(2026-10 공식 문서: A1 총 2 OCPU / 12 GB). 유휴 회수 정책이 있으므로 백업·재생성 계획을 둔다.
2. 커널에 binder(binderfs) 지원이 있는지 확인. 없으면 ReDroid 가 동작하지 않는다 — 다른 VM 이나 root 된 실제 안드로이드 기기로 대체.
3. Docker 설치 → 검증한 ReDroid 이미지 digest 를 고정 → `/data` 를 영속 볼륨으로.
4. adb 는 `127.0.0.1:5555` 에만. 화면 조작은 SSH 터널 + scrcpy. **Iris(3000)·adb 포트를 외부에 열지 않는다.**
5. 정상 배포된 KakaoTalk 설치 → 봇 전용 계정으로 전화 인증·로그인(운영자 수동). 인증 우회는 하지 않는다.
6. Iris 공식 release 로 root 구동 → 콜백 URL 을 `http://127.0.0.1:8790/iris` 로 설정 → 테스트 방에서 실제 payload 를 기록하고 `adapters.ts` 매핑을 맞춘다.
7. relay 설치:
   ```bash
   sudo useradd --system --home /opt/katcha katcha
   sudo mkdir -p /opt/katcha /var/lib/katcha /etc/katcha && sudo chown katcha /var/lib/katcha
   # 저장소를 /opt/katcha 에 배치 (Node 22.18+ 필요, npm install --omit=dev)
   sudo cp gateway/relay/katcha-relay.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now katcha-relay
   ```
   `/etc/katcha/relay.env` (권한 600):
   ```
   GATEWAY_ID=gw-01
   GATEWAY_SIGNING_KEY=<32자 이상 랜덤. 웹의 GATEWAY_KEYRING {"gw-01":"..."} 과 같은 값>
   WEB_API_BASE_URL=https://kakaobot-nine.vercel.app
   IRIS_BASE_URL=http://127.0.0.1:3000
   RELAY_ADAPTER=iris
   SQLITE_PATH=/var/lib/katcha/relay.db
   SELF_SENDER_ID=<봇 계정의 원본 user id — Iris payload 에서 확인>
   ```
8. Vercel 환경변수 `GATEWAY_KEYRING` 에 같은 키를 넣고 Redeploy.
9. 검증: 테스트 방 호출 → 답변 1건, 일반 대화 무반응, 일시정지/재시작, 같은 이벤트 재전송, self loop 없음, 재부팅 후 세션 유지, 24시간 수신.

백업: Android `/data` 볼륨과 `relay.db` 를 따로 백업한다. 복구 후 오래된 송신은 relay 가 10분 cutoff 로 보내지 않는다.
