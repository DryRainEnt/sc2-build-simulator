import type { HarvestModel } from "./types";

// 채취율 모델: 특정 순간의 "미네랄 채취 일꾼 수"와 "패치 수"로부터 초당 수입을 계산.
//
// 스타2 경제의 핵심 비선형성: 패치당 앞의 2기는 정상 채취(고효율),
// 3번째 일꾼은 대기시간 때문에 절반 이하 효율(포화). 그 이상은 채취 불가(유휴).
// 가스는 간헐천당 최대 3기까지 선형, 그 이상은 유휴.

/** 초당 미네랄 수입. */
export function mineralIncomePerSec(
  mineralWorkers: number,
  patches: number,
  m: HarvestModel,
): number {
  const w = Math.max(0, mineralWorkers);
  const normalSlots = patches * m.workersPerMineralPatch;
  const saturatedSlots =
    patches * (m.maxWorkersPerMineralPatch - m.workersPerMineralPatch);

  const normal = Math.min(w, normalSlots);
  const saturated = clamp(w - normalSlots, 0, saturatedSlots);
  // normalSlots + saturatedSlots 초과 일꾼은 유휴(수입 0).

  return normal * m.mineralPerWorker + saturated * m.mineralPerWorkerSaturated;
}

/** 초당 가스 수입. */
export function gasIncomePerSec(
  gasWorkers: number,
  geysers: number,
  m: HarvestModel,
): number {
  const slots = geysers * m.maxWorkersPerGeyser;
  const w = clamp(gasWorkers, 0, slots);
  return w * m.gasPerWorker;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
