import type { PatchData, UnitDef } from "../engine/types";

// LotV(Legacy of the Void) 기준 자원/유닛 상수.
//
// 채취율 출처: Liquipedia "Mining Minerals" / "Resources"
//   https://liquipedia.net/starcraft2/Mining_Minerals
//   - 미네랄 패치당 1·2번째 일꾼: 각 약 40/분  → 0.667/초
//   - 미네랄 패치당 3번째 일꾼:    약 20/분  → 0.333/초
//   - 가스 간헐천당 일꾼(최대 3): 각 약 38/분 → 0.633/초 (3기 포화 ~114/분)
// 시작 조건(LotV): 일꾼 12기, 미네랄 50, 가스 0, 보급 15.
// 표준 기지: 미네랄 패치 8, 간헐천 2.
//
// 주의: 값들은 커뮤니티 측정 근사치다. 정밀 수치는 커스텀 패치로 덮어쓸 수 있게
// 전부 이 파일의 상수로만 노출한다(엔진 로직에는 하드코딩 없음).

const PER_MIN = 1 / 60;

function unit(def: UnitDef): [string, UnitDef] {
  return [def.id, def];
}

const UNITS: Record<string, UnitDef> = Object.fromEntries([
  // 일꾼 (3종족)
  unit({ id: "scv", name: "SCV", race: "terran", minerals: 50, gas: 0, supply: 1, buildTime: 12, isWorker: true }),
  unit({ id: "probe", name: "Probe", race: "protoss", minerals: 50, gas: 0, supply: 1, buildTime: 12, isWorker: true }),
  unit({ id: "drone", name: "Drone", race: "zerg", minerals: 50, gas: 0, supply: 1, buildTime: 12, isWorker: true }),

  // 보급 공급
  unit({ id: "supply_depot", name: "Supply Depot", race: "terran", minerals: 100, gas: 0, supply: 0, supplyProvided: 8, buildTime: 21 }),
  unit({ id: "pylon", name: "Pylon", race: "protoss", minerals: 100, gas: 0, supply: 0, supplyProvided: 8, buildTime: 18 }),
  unit({ id: "overlord", name: "Overlord", race: "zerg", minerals: 100, gas: 0, supply: 0, supplyProvided: 8, buildTime: 18 }),

  // 기본 전투 유닛 예시 (엔진 검증용 — 이후 데이터셋 확장)
  unit({ id: "marine", name: "Marine", race: "terran", minerals: 50, gas: 0, supply: 1, buildTime: 18 }),
  unit({ id: "zealot", name: "Zealot", race: "protoss", minerals: 100, gas: 0, supply: 2, buildTime: 27 }),
  unit({ id: "zergling", name: "Zergling", race: "zerg", minerals: 25, gas: 0, supply: 1, buildTime: 17 }),
]);

export const LOTV_PATCH: PatchData = {
  id: "lotv-baseline",
  name: "LotV 기준(근사)",
  harvest: {
    mineralPerWorker: 40 * PER_MIN, // 0.667/초
    mineralPerWorkerSaturated: 20 * PER_MIN, // 0.333/초
    gasPerWorker: 38 * PER_MIN, // 0.633/초
    workersPerMineralPatch: 2,
    maxWorkersPerMineralPatch: 3,
    maxWorkersPerGeyser: 3,
  },
  start: {
    minerals: 50,
    gas: 0,
    workers: 12,
    supplyCap: 15,
  },
  base: {
    mineralPatches: 8,
    geysers: 2,
  },
  units: UNITS,
};
