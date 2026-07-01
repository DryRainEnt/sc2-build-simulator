import type { PatchData, Race, UnitCategory, UnitDef } from "./engine/types";
import { REGISTRY, getPatchById } from "./data/registry";

// 사용 가능한 패치 목록 (드롭다운). 레지스트리(patches/*.json 상속 해석 결과)에서 온다.
export const PATCHES: PatchData[] = REGISTRY;

export function getPatch(id: string): PatchData {
  return getPatchById(id);
}

export const RACES: { id: Race; label: string }[] = [
  { id: "terran", label: "테란" },
  { id: "protoss", label: "프로토스" },
  { id: "zerg", label: "저그" },
];

export function categoryOf(u: UnitDef): UnitCategory {
  return u.category;
}

/** 특정 종족 + 분류의 생산 가능 목록 (hidden 제외). */
export function unitsFor(patch: PatchData, race: Race, category: UnitCategory): UnitDef[] {
  return Object.values(patch.units).filter(
    (u) => u.race === race && u.category === category && !u.hidden,
  );
}

/** 유닛 탭 목록: 일꾼을 맨 앞에 두고 전투 유닛을 잇는다 (hidden 제외). */
export function producibleUnits(patch: PatchData, race: Race): UnitDef[] {
  return [...unitsFor(patch, race, "worker"), ...unitsFor(patch, race, "unit")];
}
