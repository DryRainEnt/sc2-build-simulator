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

/** 특정 종족 + 분류의 생산 가능 목록 (일꾼/업그레이드는 별도 탭에서 다룸). */
export function unitsFor(patch: PatchData, race: Race, category: UnitCategory): UnitDef[] {
  return Object.values(patch.units).filter(
    (u) => u.race === race && u.category === category,
  );
}
