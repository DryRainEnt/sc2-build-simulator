import { z } from "zod";

// 온디스크 패치 데이터 스키마 (zod).
//
// 유지보수 설계: 각 밸런스 패치는 파일 하나. 새 패치는 이전 패치를 `extends` 하고
// 바뀐 값만 기재한다(diff). 레지스트리가 상속 체인을 병합·검증해 엔진용 PatchData로 변환.
// 이렇게 하면 후속 패치 관리가 "전체 재입력"이 아니라 "몇 줄 오버라이드"로 끝난다.

export const zRace = z.enum(["terran", "zerg", "protoss"]);
export const zCategory = z.enum(["worker", "unit", "building", "upgrade"]);

/** 채취율 모델 (초당 자원 단위). */
export const zHarvest = z
  .object({
    mineralPerWorker: z.number().nonnegative(),
    mineralPerWorkerSaturated: z.number().nonnegative(),
    gasPerWorker: z.number().nonnegative(),
    workersPerMineralPatch: z.number().int().positive(),
    maxWorkersPerMineralPatch: z.number().int().positive(),
    maxWorkersPerGeyser: z.number().int().positive(),
  })
  .strict();

export const zStart = z
  .object({
    minerals: z.number().nonnegative(),
    gas: z.number().nonnegative(),
    workers: z.number().int().nonnegative(),
    supplyCap: z.number().nonnegative(),
  })
  .strict();

export const zBase = z
  .object({
    mineralPatches: z.number().int().nonnegative(),
    geysers: z.number().int().nonnegative(),
  })
  .strict();

/** 유닛/건물/업그레이드 1건. id는 units 맵의 키에서 주입되므로 여기엔 없음. */
export const zUnit = z
  .object({
    name: z.string(),
    race: zRace,
    category: zCategory,
    minerals: z.number().nonnegative(),
    gas: z.number().nonnegative(),
    supply: z.number(),
    supplyProvided: z.number().optional(),
    buildTime: z.number().nonnegative(),
    producedFrom: z.array(z.string()).optional(),
    requires: z.array(z.string()).optional(),
    morphedFrom: z.string().optional(),
    startCount: z.number().int().nonnegative().optional(),
    /** 이 항목 수치의 출처/비고 (검증 추적용). */
    note: z.string().optional(),
  })
  .strict();

const meta = {
  version: z.string(),
  name: z.string(),
  releaseDate: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
};

/** 완전한 패치 정의 (베이스). */
export const zPatchFull = z
  .object({
    ...meta,
    harvest: zHarvest,
    start: zStart,
    base: zBase,
    units: z.record(zUnit),
  })
  .strict();

/** 상속 오버라이드 패치. extends 필수, 나머지는 부분(diff). */
export const zPatchOverride = z
  .object({
    ...meta,
    name: meta.name.optional(),
    extends: z.string(),
    harvest: zHarvest.partial().optional(),
    start: zStart.partial().optional(),
    base: zBase.partial().optional(),
    units: z.record(zUnit.partial()).optional(),
  })
  .strict();

export type RaceId = z.infer<typeof zRace>;
export type PatchFull = z.infer<typeof zPatchFull>;
export type PatchOverride = z.infer<typeof zPatchOverride>;
export type PatchFile = PatchFull | PatchOverride;
export type UnitEntry = z.infer<typeof zUnit>;

/** 오버라이드 패치 여부(= extends 보유). */
export function isOverride(p: unknown): p is PatchOverride {
  return typeof p === "object" && p !== null && "extends" in p;
}
