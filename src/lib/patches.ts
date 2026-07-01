import type { PatchData, Race, UnitDef } from "./engine/types";
import { LOTV_PATCH } from "./data/lotv";

// 사용 가능한 공식 패치 목록 (드롭다운에 표시). 커스텀 패치는 이후 여기에 추가/덮어쓰기.
export const PATCHES: PatchData[] = [LOTV_PATCH];

export function getPatch(id: string): PatchData {
  return PATCHES.find((p) => p.id === id) ?? LOTV_PATCH;
}

export const RACES: { id: Race; label: string }[] = [
  { id: "terran", label: "테란" },
  { id: "protoss", label: "프로토스" },
  { id: "zerg", label: "저그" },
];

/** 유닛 탭 분류: 건물 = 보급 공급/건설물, 유닛 = 그 외 생산 유닛(일꾼 포함). */
export type UnitCategory = "unit" | "building";

export function categoryOf(u: UnitDef): UnitCategory {
  return u.supplyProvided ? "building" : "unit";
}

/** 특정 종족 + 분류에 해당하는 생산 가능 목록. */
export function unitsFor(patch: PatchData, race: Race, category: UnitCategory): UnitDef[] {
  return Object.values(patch.units).filter(
    (u) => u.race === race && categoryOf(u) === category,
  );
}
