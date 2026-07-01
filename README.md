# SCBS — 스타크래프트2 빌드 시뮬레이터

채취 중인 일꾼 수에 따라 **임의 시점의 미네랄/가스/인구를 정확히 계산**하는 웹 빌드 오더 시뮬레이터.

## 스택

Svelte 4 + TypeScript + Vite. 테스트는 Vitest.

```bash
npm install
npm run dev      # 개발 서버 (엔진 프리뷰 표 표시)
npm test         # 엔진 단위 테스트
npm run check    # svelte-check 타입 검사
npm run build    # 프로덕션 빌드
```

## 구조

```
src/
  lib/
    engine/
      types.ts       # 도메인 타입 (PatchData, BuildEvent, ResourceState ...)
      harvest.ts     # 채취율 모델 (일꾼수·패치수 → 초당 수입)
      simulate.ts    # 시뮬레이션 엔진 (이벤트 타임라인 → 시점별 상태)
      engine.test.ts # 단위 테스트 (12 케이스)
    data/
      lotv.ts        # LotV 자원/유닛 상수 (Liquipedia 근거)
  App.svelte         # 임시 엔진 프리뷰 셸 (실제 UI는 다음 단계)
```

## 엔진 설계 요점

- **모든 게임 상수는 `PatchData`에 모음.** 엔진 로직에 밸런스 수치를 하드코딩하지
  않으므로, "공식 패치 선택 / 커스텀 패치 작성" 기능이 이 구조 위에 그대로 얹힌다.
- **채취율 비선형성 반영**: 미네랄 패치당 1·2번째 일꾼은 고효율(약 40/분), 3번째는
  포화 저효율(약 20/분), 그 이상은 유휴. 가스는 간헐천당 3기까지 선형.
- **시간 적분**: 이벤트 사이 구간에서는 채취 수입이 일정하므로 선형 적분. 수입은 항상
  ≥ 0 이므로 자원이 마이너스가 되는 지점은 오직 소모(생산 주문) 시점뿐 → 그 지점만
  검사해 **자원 부족 오류 마커**를 만든다.
- `stateAt(t)`로 임의 시점 상태를 O(log n) 조회 (시간선 커서/마커에 사용 예정).

### 지원 이벤트

`train_worker`, `train_unit`, `build_structure`, `worker_transfer`(채취 일시정지),
`assign_worker`(미네랄↔가스 재배치), `unit_death`.

## 데이터 아키텍처 (패치 버전 관리)

밸런스 패치가 바뀔 때마다 데이터를 쉽게 유지보수하도록 **버전별 파일 + 상속 오버라이드**
구조로 설계했다.

```
src/lib/data/
  schema.ts        # zod 스키마 (온디스크 데이터 형태의 단일 진실 공급원)
  registry.ts      # 상속(extends) 해석 + 깊은 병합 + 검증 → 엔진용 PatchData
  patches/
    5.0.14.json    # 완전한 베이스 패치
```

- 각 패치는 파일 하나. `patches/*.json` 은 자동 로드·검증된다.
- **새 패치는 이전 패치를 `extends` 하고 바뀐 값만 적는다(diff).** 예:

  ```json
  { "version": "5.0.15", "extends": "5.0.14", "name": "5.0.15",
    "source": "https://liquipedia.net/starcraft2/Patch_5.0.15",
    "units": { "marine": { "minerals": 45 } } }
  ```

  → 마린 비용만 바뀌고 나머지는 5.0.14 를 그대로 상속. 전체 재입력 불필요.
- 로드 시 zod 로 검증하며, **새 유닛을 부분정의로만 추가하면 실패**(완전 정의 강제).
- 유닛 스키마는 정확도에 필요한 필드를 모두 담는다: 비용/보급/생산시간 +
  `producedFrom`(생산원), `requires`(테크 선행조건), `morphedFrom`(저그 변태), `note`(출처/검증).

> 현재 `5.0.14.json` 의 유닛 수치는 **WIP**다. mineral/gas 비용은 알려진 값이나
> `buildTime` 등은 공식/위키 대조 검증이 필요하며, 이는 M2(테란)부터 채운다.

## 자원 수치 출처

LotV 기준, Liquipedia [Mining Minerals](https://liquipedia.net/starcraft2/Mining_Minerals)
/ [Resources](https://liquipedia.net/starcraft2/Resources). 커뮤니티 측정 근사치이며,
`src/lib/data/lotv.ts` 상수만 고치면 정밀화·패치 대응 가능.

## UI 골격 (구현됨)

`src/lib/components/` — 상태는 `src/lib/stores/sim.ts`(Svelte store)에 집중.

- `TopBar` — 패치 드롭다운 + 메뉴 바(커스텀패치/export/import/표시설정, 핸들러는 자리표시자)
- `TabPanel` — 좌/우 진영: 종족 선택 + 유닛/건물/행동 탭 + 바둑판 그리드.
  아이콘 클릭 시 현재 마커에 생산 이벤트 추가(중복=중첩).
- `TimeArea` — 중앙 세로 시간선(1초=4px). 커서 hover→가로줄 + 양 진영 자원 표시,
  클릭→마커 배치, 마커별 자원 readout, 자원 부족 시 빨간 오류 마커.

## 알려진 한계 / 다음 단계

- **미네랄 패치 고갈 미반영** (장기 빌드에서 실제보다 수입 과대). 향후 패치별 잔량 추적.
- 보급은 완성 시점에 반영(주문 시점 예약 아님) — 모델링 선택.
- 유닛 데이터셋은 최소(일꾼·보급·예시 유닛)만 수록 — 확장 필요.
- 메뉴 바 기능(export/import/커스텀 패치/표시 설정) 핸들러 미구현.
- 마커에 배치된 생산 큐의 시각적 목록/편집 UI 미구현(자원 계산에는 이미 반영됨).
```
