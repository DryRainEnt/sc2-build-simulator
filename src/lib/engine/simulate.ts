import { gasIncomePerSec, mineralIncomePerSec } from "./harvest";
import { scheduleProduction } from "./schedule";
import type {
  BuildEvent,
  PatchData,
  Race,
  ResourceError,
  ResourceState,
  SimulationResult,
  TechWarning,
  UnitDef,
} from "./types";

export interface SimulateOptions {
  /** 시뮬레이션 총 길이(초). */
  duration: number;
  /** train_worker 이벤트가 생산할 일꾼의 종족 (기본 terran). */
  race?: Race;
}

// 내부 표현: 이벤트를 시각별 "연산(op)"으로 펼친다.
// 일부 op(일꾼 재배치/사망)는 그 시점의 라이브 상태에 의존하므로,
// 고정 숫자 델타가 아니라 walk 중에 가변 상태를 참조해 적용한다.
type Op =
  | { t: number; type: "spend"; minerals: number; gas: number; supply: number; worker?: boolean }
  | { t: number; type: "complete"; def: UnitDef }
  | { t: number; type: "pauseStart"; resource: "minerals" | "gas"; workers: number }
  | { t: number; type: "pauseEnd"; resource: "minerals" | "gas"; workers: number }
  | { t: number; type: "assign"; to: "minerals" | "gas"; workers: number }
  | { t: number; type: "death"; isWorker: boolean; supply: number; count: number };

interface Segment {
  start: number;
  /** 구간 시작까지 채취한 자원 누적(연속·소모 미반영). stateAt에서 왕복 단위로 절삭. */
  minedMin: number;
  minedGas: number;
  /** 구간 시작까지 소모(생산 주문) 누적. */
  spentMin: number;
  spentGas: number;
  mineralRate: number;
  gasRate: number;
  supplyUsed: number;
  supplyCap: number;
  mineralWorkers: number;
  gasWorkers: number;
  workersInProd: number;
}

/** 채취분을 왕복 단위(step)로 절삭 — 일꾼이 한 번 왕복해야 그만큼 실제 반영. */
function quantize(amount: number, step: number): number {
  return step > 0 ? Math.floor(amount / step) * step : amount;
}

function findWorker(patch: PatchData, race: Race): UnitDef {
  const w = Object.values(patch.units).find((u) => u.isWorker && u.race === race);
  if (!w) throw new Error(`패치 '${patch.id}'에 종족 '${race}'의 일꾼 정의가 없습니다.`);
  return w;
}

/** 이벤트 목록을 시각별 op 목록으로 전개. completeAt: eventIndex→실제 완료 시각(스케줄). */
function buildOps(
  events: BuildEvent[],
  patch: PatchData,
  race: Race,
  duration: number,
  completeAt: Map<number, number>,
): Op[] {
  const ops: Op[] = [];
  const push = (op: Op) => {
    if (op.t <= duration) ops.push(op);
  };

  // 주문 시점(마커)에 자원+보급 소모, 스케줄된 완료 시점에 유닛 등장/보급 공급.
  const emitProduction = (index: number, t: number, def: UnitDef) => {
    push({ t, type: "spend", minerals: def.minerals, gas: def.gas, supply: def.supply, worker: def.isWorker });
    const completeTime = completeAt.get(index) ?? t + def.buildTime;
    push({ t: completeTime, type: "complete", def });
  };

  events.forEach((e, i) => {
    switch (e.kind) {
      case "train_worker":
        emitProduction(i, e.time, findWorker(patch, race));
        break;
      case "train_unit": {
        const def = patch.units[e.unitId];
        if (!def) throw new Error(`알 수 없는 유닛 id: ${e.unitId}`);
        emitProduction(i, e.time, def);
        break;
      }
      case "build_structure": {
        const def = patch.units[e.unitId];
        if (!def) throw new Error(`알 수 없는 유닛 id: ${e.unitId}`);
        emitProduction(i, e.time, def);
        // 저그만: 드론이 건물로 변태 → 주문 시점에 일꾼 1 소모(+보급 1 반환).
        // 건물 변태(둥지/군락 등, producedFrom=건물)는 드론 소모 없음.
        if (race === "zerg" && def.producedFrom?.includes(findWorker(patch, race).id)) {
          push({ t: e.time, type: "death", isWorker: true, supply: 1, count: 1 });
        }
        break;
      }
      case "worker_transfer": {
        const resource = e.resource ?? "minerals";
        push({ t: e.time, type: "pauseStart", resource, workers: e.workers });
        push({ t: e.time + e.duration, type: "pauseEnd", resource, workers: e.workers });
        break;
      }
      case "assign_worker":
        push({ t: e.time, type: "assign", to: e.to, workers: e.workers });
        break;
      case "unit_death": {
        const count = e.count ?? 1;
        const isWorker = e.unitId === "worker" || patch.units[e.unitId]?.isWorker === true;
        const supply = isWorker ? 1 : (patch.units[e.unitId]?.supply ?? 0);
        push({ t: e.time, type: "death", isWorker, supply, count });
        break;
      }
      case "addon": {
        // 애드온(반응로) 비용은 주문 시점에 소모 (보급 0). 슬롯 효과는 스케줄러에서.
        const def = patch.units[e.addon];
        if (def) push({ t: e.time, type: "spend", minerals: def.minerals, gas: def.gas, supply: 0 });
        break;
      }
    }
  });

  // 시각 오름차순 정렬 (동일 시각은 삽입 순서 유지 = 안정 정렬).
  return ops
    .map((op, i) => ({ op, i }))
    .sort((a, b) => a.op.t - b.op.t || a.i - b.i)
    .map((x) => x.op);
}

/**
 * 빌드 이벤트 타임라인을 시뮬레이션한다.
 * - 구간(op 사이)마다 채취 수입은 일정하므로 선형 적분.
 * - 자원 수입은 항상 ≥ 0 이므로 자원이 마이너스가 되는 건 오직 소모(spend) 지점뿐 →
 *   각 breakpoint 적용 직후에만 부족 여부를 검사하면 충분하다.
 */
export function simulate(
  events: BuildEvent[],
  patch: PatchData,
  options: SimulateOptions,
): SimulationResult {
  const { duration } = options;
  const race = options.race ?? "terran";
  const model = patch.harvest;
  const patches = patch.base.mineralPatches;
  const geysers = patch.base.geysers;

  // 생산 스케줄(슬롯 배정)로 각 유닛의 실제 완료 시각 계산.
  const completeAt = new Map<number, number>();
  for (const s of scheduleProduction(events, patch, race)) completeAt.set(s.eventIndex, s.end);

  const ops = buildOps(events, patch, race, duration, completeAt);

  const perTripMin = model.mineralsPerTrip;
  const perTripGas = model.gasPerTrip;

  // 라이브 상태 (채취 누적/소모 누적 분리)
  let minedMin = 0;
  let minedGas = 0;
  let spentMin = 0;
  let spentGas = 0;
  let supplyUsed = patch.start.workers;
  // 시작 보급 상한 = 종족 시작 보유 유닛/건물(본진, 저그는 대군주)의 공급 합
  let supplyCap = 0;
  for (const u of Object.values(patch.units)) {
    if (u.race === race && u.startCount && u.supplyProvided) supplyCap += u.startCount * u.supplyProvided;
  }
  let mineralWorkers = patch.start.workers;
  let gasWorkers = 0;
  let workersInProd = 0; // 생산 중(주문됨·완성 전) 일꾼 수
  let pausedMineral = 0;
  let pausedGas = 0;

  const rates = () => ({
    mineralRate: mineralIncomePerSec(mineralWorkers - pausedMineral, patches, model),
    gasRate: gasIncomePerSec(gasWorkers - pausedGas, geysers, model),
  });

  const applyOp = (op: Op) => {
    switch (op.type) {
      case "spend":
        spentMin += op.minerals;
        spentGas += op.gas;
        supplyUsed += op.supply; // 인구는 생산 시작 시점에 소모(예약)
        if (op.worker) workersInProd += 1; // 생산 중 일꾼(완성 전까지 병력 아님)
        break;
      case "complete":
        // 완성 시점: 일꾼은 채취 합류, 보급 건물은 보급 공급 (소모는 이미 시작 때 반영)
        if (op.def.isWorker) {
          mineralWorkers += 1;
          workersInProd -= 1;
        }
        if (op.def.supplyProvided) supplyCap += op.def.supplyProvided;
        break;
      case "pauseStart":
        if (op.resource === "minerals") pausedMineral += op.workers;
        else pausedGas += op.workers;
        break;
      case "pauseEnd":
        if (op.resource === "minerals") pausedMineral -= op.workers;
        else pausedGas -= op.workers;
        break;
      case "assign": {
        if (op.to === "gas") {
          const n = Math.min(op.workers, mineralWorkers);
          mineralWorkers -= n;
          gasWorkers += n;
        } else {
          const n = Math.min(op.workers, gasWorkers);
          gasWorkers -= n;
          mineralWorkers += n;
        }
        break;
      }
      case "death": {
        let remaining = op.count;
        const fromMin = Math.min(remaining, mineralWorkers);
        if (op.isWorker) {
          mineralWorkers -= fromMin;
          remaining -= fromMin;
          gasWorkers = Math.max(0, gasWorkers - remaining);
        }
        supplyUsed = Math.max(0, supplyUsed - op.count * op.supply);
        break;
      }
    }
  };

  const segments: Segment[] = [];
  const errors: ResourceError[] = [];

  // breakpoint 시각들: 0, 각 op 시각, duration.
  const times = uniqueSortedTimes(ops, duration);

  let idx = 0; // ops 커서
  let prevStart = 0;
  let prevRates = rates();

  for (let k = 0; k < times.length; k++) {
    const t = times[k];
    // 직전 구간 [prevStart, t] 채취 적분 (연속 누적)
    if (k > 0) {
      const dt = t - prevStart;
      minedMin += prevRates.mineralRate * dt;
      minedGas += prevRates.gasRate * dt;
    }
    // 이 시각의 모든 op 적용
    while (idx < ops.length && ops[idx].t === t) {
      applyOp(ops[idx]);
      idx++;
    }
    // 부족 검사 (소모 반영 직후, 채취는 왕복 단위로 절삭한 실보유 기준)
    const availMin = patch.start.minerals + quantize(minedMin, perTripMin) - spentMin;
    const availGas = patch.start.gas + quantize(minedGas, perTripGas) - spentGas;
    if (availMin < 0) {
      errors.push({ time: t, resource: "minerals", deficit: -availMin });
    }
    if (availGas < 0) {
      errors.push({ time: t, resource: "gas", deficit: -availGas });
    }
    // 새 구간의 rate 확정 및 세그먼트 기록
    const r = rates();
    segments.push({
      start: t,
      minedMin,
      minedGas,
      spentMin,
      spentGas,
      mineralRate: r.mineralRate,
      gasRate: r.gasRate,
      supplyUsed,
      supplyCap,
      mineralWorkers,
      gasWorkers,
      workersInProd,
    });
    prevStart = t;
    prevRates = r;
  }

  const stateAt = (time: number): ResourceState => {
    const tc = Math.max(0, Math.min(duration, time));
    const seg = segmentAt(segments, tc);
    const dt = tc - seg.start;
    const rawMin = seg.minedMin + seg.mineralRate * dt;
    const rawGas = seg.minedGas + seg.gasRate * dt;
    return {
      minerals: patch.start.minerals + quantize(rawMin, perTripMin) - seg.spentMin,
      gas: patch.start.gas + quantize(rawGas, perTripGas) - seg.spentGas,
      supplyUsed: seg.supplyUsed,
      supplyCap: seg.supplyCap,
      workers: seg.mineralWorkers + seg.gasWorkers,
      mineralWorkers: seg.mineralWorkers,
      gasWorkers: seg.gasWorkers,
      workersInProd: seg.workersInProd,
      mineralRate: seg.mineralRate,
      gasRate: seg.gasRate,
    };
  };

  const techWarnings = computeTechWarnings(events, patch, race, duration);

  return { stateAt, errors, techWarnings };
}

/** 생산/건설 이벤트가 만들어내는 유닛 정의를 해석. 그 외 이벤트는 null. */
function producedDef(e: BuildEvent, patch: PatchData, race: Race): UnitDef | null {
  switch (e.kind) {
    case "train_worker":
      return findWorker(patch, race);
    case "train_unit":
    case "build_structure":
      return patch.units[e.unitId] ?? null;
    default:
      return null;
  }
}

/**
 * 테크 선행조건 게이팅: 각 생산/건설 이벤트의 requires 가 그 주문 시점에
 * 이미 완성돼 있는지 검사한다. 미충족이면 경고(차단 아님).
 *
 * 가용성 판정: 어떤 id 의 "최초 완성 시각" = min(시작보유면 0, 각 생산 이벤트의 time+buildTime).
 * 선행조건 reqId 의 최초 완성 시각이 이벤트 주문 시각보다 크면(또는 없으면) 미충족.
 */
function computeTechWarnings(
  events: BuildEvent[],
  patch: PatchData,
  race: Race,
  duration: number,
): TechWarning[] {
  const firstComplete = new Map<string, number>();
  const seed = (id: string, t: number) => {
    const cur = firstComplete.get(id);
    if (cur === undefined || t < cur) firstComplete.set(id, t);
  };

  // 시작 보유 구조물(본진 등)은 t=0 에 완성된 것으로 시드.
  for (const u of Object.values(patch.units)) {
    if (u.startCount && u.startCount > 0) seed(u.id, 0);
  }
  // 각 생산 이벤트의 완성 시각 반영.
  for (const e of events) {
    const def = producedDef(e, patch, race);
    if (def) seed(def.id, e.time + def.buildTime);
    // 애드온(기술실 등)도 완성 시 해당 테크 충족으로 시드.
    if (e.kind === "addon") {
      const ad = patch.units[e.addon];
      if (ad) seed(e.addon, e.time + ad.buildTime);
    }
  }

  const warnings: TechWarning[] = [];
  for (const e of events) {
    if (e.time < 0 || e.time > duration) continue;
    const def = producedDef(e, patch, race);
    if (!def?.requires?.length) continue;
    const missing = def.requires.filter((reqId) => {
      const ct = firstComplete.get(reqId);
      return ct === undefined || ct > e.time;
    });
    if (missing.length > 0) warnings.push({ time: e.time, unitId: def.id, missing });
  }
  return warnings;
}

function uniqueSortedTimes(ops: Op[], duration: number): number[] {
  const set = new Set<number>([0, duration]);
  for (const op of ops) if (op.t >= 0 && op.t <= duration) set.add(op.t);
  return [...set].sort((a, b) => a - b);
}

/** start ≤ t 인 마지막 세그먼트를 이진 탐색으로 찾는다. */
function segmentAt(segments: Segment[], t: number): Segment {
  let lo = 0;
  let hi = segments.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return segments[ans];
}
