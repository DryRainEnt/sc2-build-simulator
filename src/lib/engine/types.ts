// 스타크래프트2 빌드 시뮬레이터 — 핵심 도메인 타입
//
// 설계 원칙: 자원 계산 엔진은 "패치 데이터(상수)"와 "빌드 이벤트(시간순 행동)"를
// 입력으로 받아, 임의 시점의 자원/보급/일꾼 상태를 계산한다.
// 패치별로 채취율·유닛 코스트가 다르므로 모든 게임 상수는 PatchData에 모은다
// (공식 패치 선택 / 커스텀 패치 작성 기능이 이 구조 위에 얹힌다).

export type Race = "terran" | "zerg" | "protoss";

/** 채취 대상 종류. */
export type ResourceKind = "minerals" | "gas";

/** 유닛 분류. worker=일꾼, unit=생산유닛, building=건물, upgrade=업그레이드. */
export type UnitCategory = "worker" | "unit" | "building" | "upgrade";

/** 유닛/건물 정의 (패치 데이터에 수록). */
export interface UnitDef {
  id: string;
  name: string;
  race: Race;
  /** 분류. 데이터에 명시, UI 탭/엔진 로직 분기에 사용. */
  category: UnitCategory;
  minerals: number;
  gas: number;
  /** 보급 소모량. 일꾼=1, 건물=0(대개), 보급 공급 유닛은 음수 대신 supplyProvided 사용. */
  supply: number;
  /** 이 유닛/건물이 공급하는 보급 (예: 서플라이 디폿=8, 오버로드=8, 사령부=15). */
  supplyProvided?: number;
  /** 생산/건설 소요 시간(초). */
  buildTime: number;
  /** 이 유닛/건물을 생산하는 생산원 id들 (예: 마린 → ["barracks"]). 생산용량 모델용. */
  producedFrom?: string[];
  /** 테크 선행조건 id들 (예: 마린 → ["barracks"]). 테크 게이팅용. */
  requires?: string[];
  /** 저그 변태 원본 (예: 드론 → "larva", 스포닝풀 → "drone"). */
  morphedFrom?: string;
  /** 애벌레 소모량 (라바 유닛 기본 1, 저글링=0.5[라바1당 2마리]). */
  larvaCost?: number;
  /** 게임 시작 시 보유 개수 (예: 종족별 본진 건물 1). 테크 게이팅 시드용. */
  startCount?: number;
  /** UI 생산 그리드에서 숨김 (정의·계산에는 유지). 예: MULE. */
  hidden?: boolean;
  /** 애드온(반응로/기술실) — 클릭 시 선택된 건물 열에 부착. */
  addon?: boolean;
  /** 일꾼 여부 — 완성 시 채취 인구에 합류. category==="worker"에서 파생. */
  isWorker?: boolean;
}

/** 자원 채취율 모델 파라미터. 값 단위는 "초당 자원". */
export interface HarvestModel {
  /** 미네랄 패치 1개당 1~2번째 일꾼의 초당 채취량. */
  mineralPerWorker: number;
  /** 미네랄 패치 1개당 3번째(포화 초과) 일꾼의 초당 채취량. */
  mineralPerWorkerSaturated: number;
  /** 가스 간헐천 1개당 일꾼(최대 3기)의 초당 채취량. */
  gasPerWorker: number;
  /** 일꾼 1회 왕복당 미네랄 획득량(보통 5). 이 단위로 절삭 반영. */
  mineralsPerTrip: number;
  /** 일꾼 1회 왕복당 가스 획득량(보통 4). */
  gasPerTrip: number;
  /** 패치당 정상 채취 일꾼 슬롯 수 (보통 2). */
  workersPerMineralPatch: number;
  /** 패치당 최대 일꾼 수 (보통 3). */
  maxWorkersPerMineralPatch: number;
  /** 간헐천당 최대 일꾼 수 (보통 3). */
  maxWorkersPerGeyser: number;
}

/** 한 진영의 시작 기지 구성 (패치/맵 기본값). */
export interface BaseSetup {
  mineralPatches: number;
  geysers: number;
}

/** 패치(게임 밸런스 버전) 전체 데이터. */
export interface PatchData {
  id: string;
  name: string;
  harvest: HarvestModel;
  /** 종족별 시작 조건. */
  start: {
    minerals: number;
    gas: number;
    workers: number;
    supplyCap: number;
  };
  base: BaseSetup;
  /** 저그 애벌레 설정 (없으면 엔진 기본값). */
  larva?: {
    /** 애벌레 1개 생성 주기(초). 예: 5.0.16 = 9.9. */
    spawnSeconds: number;
    /** 기지(부화장/둥지/군락)당 최대 애벌레. 보통 3. */
    perBase: number;
    /** 퀸 인젝트당 추가 애벌레 (보통 3). */
    injectAmount?: number;
  };
  units: Record<string, UnitDef>;
}

// ── 빌드 이벤트 (시간선 마커에 배치되는 행동들) ────────────────────────────

export interface TrainWorkerEvent {
  time: number;
  kind: "train_worker";
}

export interface TrainUnitEvent {
  time: number;
  kind: "train_unit";
  /** PatchData.units 의 키. */
  unitId: string;
}

export interface BuildStructureEvent {
  time: number;
  kind: "build_structure";
  unitId: string;
}

/** 일꾼 이동/재배치 — 지정 구간 동안 N기의 채취를 일시정지. */
export interface WorkerTransferEvent {
  time: number;
  kind: "worker_transfer";
  workers: number;
  /** 정지 지속 시간(초). */
  duration: number;
  /** 어느 자원 채취를 멈추는가 (기본: minerals). */
  resource?: ResourceKind;
}

/** 일꾼을 가스로 이동(또는 가스→미네랄). 순수 재배치, 총 일꾼 수 불변. */
export interface AssignWorkerEvent {
  time: number;
  kind: "assign_worker";
  /** 이동할 일꾼 수. to 방향으로 재배치. */
  workers: number;
  to: ResourceKind;
}

/** 유닛 사망 — 일꾼이면 채취 인구 감소, 보급도 반영. */
export interface UnitDeathEvent {
  time: number;
  kind: "unit_death";
  /** 사망 유닛 id (일꾼이면 "worker"). */
  unitId: string;
  count?: number;
}

/** 퀸 인젝트 — 부화장에 애벌레를 추가 생성(저그). */
export interface QueenInjectEvent {
  time: number;
  kind: "inject";
}

/** 애드온 부착 — 특정 생산건물 인스턴스(machineId)에 반응로 등. */
export interface AddonEvent {
  time: number;
  kind: "addon";
  /** 대상 건물 인스턴스 id ("barracks#0" 등). */
  machineId: string;
  /** 애드온 종류. */
  addon: "reactor" | "tech_lab";
}

export type BuildEvent =
  | TrainWorkerEvent
  | TrainUnitEvent
  | BuildStructureEvent
  | WorkerTransferEvent
  | AssignWorkerEvent
  | UnitDeathEvent
  | QueenInjectEvent
  | AddonEvent;

// ── 시뮬레이션 결과 ────────────────────────────────────────────────────

export interface ResourceState {
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyCap: number;
  /** 총 일꾼 수. */
  workers: number;
  /** 미네랄 채취 일꾼 수. */
  mineralWorkers: number;
  /** 가스 채취 일꾼 수. */
  gasWorkers: number;
}

/** 자원이 마이너스가 되는 지점 (빨간 오류 마커). */
export interface ResourceError {
  time: number;
  resource: ResourceKind;
  /** 부족한 양(음수 절댓값). */
  deficit: number;
}

/** 테크 선행조건 미충족 지점 (경고 마커). 차단이 아니라 표시만 한다(사양서 철학). */
export interface TechWarning {
  time: number;
  /** 배치하려는 유닛/건물 id. */
  unitId: string;
  /** 그 시점에 아직 완성되지 않았거나 없는 선행조건 id들. */
  missing: string[];
}

export interface SimulationOptions {
  /** 시뮬레이션 총 길이(초). */
  duration: number;
}

export interface SimulationResult {
  /** 임의 시점 t(초)의 자원/보급 상태. */
  stateAt: (t: number) => ResourceState;
  /** 자원 부족(마이너스) 발생 지점들. */
  errors: ResourceError[];
  /** 테크 선행조건 미충족 경고들. */
  techWarnings: TechWarning[];
}
