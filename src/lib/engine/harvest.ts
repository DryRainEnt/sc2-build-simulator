import type { HarvestModel } from "./types";

// 채취율 모델: 특정 순간의 "미네랄 채취 일꾼 수"와 "패치 수"로부터 초당 수입을 계산.
//
// 스타2 경제의 핵심 비선형성: 패치당 앞의 2기는 정상 채취(고효율),
// 3번째 일꾼은 대기시간 때문에 절반 이하 효율(포화). 그 이상은 채취 불가(유휴).
// 가스도 동일: 간헐천당 앞 2기는 고효율, 3번째는 포화 저효율, 그 이상은 유휴.
// (게임 내부시간 기준. 화면 Faster 속도의 실측값을 ÷1.4 하여 게임초로 환산.)

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

/** 초당 가스 수입. 미네랄과 동일하게 간헐천당 앞 2기 고효율 + 3번째 포화. */
export function gasIncomePerSec(
  gasWorkers: number,
  geysers: number,
  m: HarvestModel,
): number {
  const w = Math.max(0, gasWorkers);
  const normalSlots = geysers * m.workersPerGeyser;
  const saturatedSlots = geysers * (m.maxWorkersPerGeyser - m.workersPerGeyser);

  const normal = Math.min(w, normalSlots);
  const saturated = clamp(w - normalSlots, 0, saturatedSlots);
  // normalSlots + saturatedSlots 초과 일꾼은 유휴(수입 0).

  return normal * m.gasPerWorker + saturated * m.gasPerWorkerSaturated;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
