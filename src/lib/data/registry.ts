import type { PatchData, UnitDef } from "../engine/types";
import {
  isOverride,
  zPatchFull,
  zPatchOverride,
  type PatchFile,
  type PatchFull,
  type UnitEntry,
} from "./schema";

// 패치 레지스트리: 온디스크 패치 파일(베이스/오버라이드)을 상속 병합·검증해
// 엔진용 PatchData 로 변환한다.

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** 깊은 병합. 객체는 재귀 병합, 그 외(배열 포함)는 b로 교체. */
function deepMerge<T>(a: T, b: unknown): T {
  if (!isPlainObject(a) || !isPlainObject(b)) {
    return (b === undefined ? a : (b as T));
  }
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = isPlainObject(out[k]) && isPlainObject(b[k]) ? deepMerge(out[k], b[k]) : b[k];
  }
  return out as T;
}

/** 유닛 맵 병합: 기존 id는 필드 병합, 새 id는 추가(이후 zPatchFull 검증이 완전성 강제). */
function mergeUnits(
  base: Record<string, UnitEntry>,
  ov: Record<string, Partial<UnitEntry>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const id of Object.keys(ov)) {
    out[id] = out[id] ? deepMerge(out[id], ov[id]) : ov[id];
  }
  return out;
}

/**
 * 버전의 상속 체인을 해석해 완전한 검증된 패치를 반환.
 * @param rawByVersion 원본 패치 파일 맵 (version → PatchFile)
 */
export function resolvePatch(
  version: string,
  rawByVersion: Map<string, PatchFile>,
  seen: Set<string> = new Set(),
): PatchFull {
  const raw = rawByVersion.get(version);
  if (!raw) throw new Error(`패치 버전을 찾을 수 없습니다: ${version}`);

  if (!isOverride(raw)) {
    return zPatchFull.parse(raw);
  }

  if (seen.has(version)) {
    throw new Error(`패치 상속 순환 감지: ${[...seen, version].join(" → ")}`);
  }
  seen.add(version);

  const ov = zPatchOverride.parse(raw);
  const base = resolvePatch(ov.extends, rawByVersion, seen);

  const merged = {
    version: ov.version,
    name: ov.name ?? base.name,
    releaseDate: ov.releaseDate ?? base.releaseDate,
    source: ov.source ?? base.source,
    notes: ov.notes ?? base.notes,
    harvest: deepMerge(base.harvest, ov.harvest ?? {}),
    start: deepMerge(base.start, ov.start ?? {}),
    base: deepMerge(base.base, ov.base ?? {}),
    units: mergeUnits(base.units, ov.units ?? {}),
  };

  // 병합 결과를 완전한 패치로 재검증 (새 유닛이 부분정의면 여기서 실패 → 완전 정의 강제).
  return zPatchFull.parse(merged);
}

/** producedFrom/requires 가 가리켜도 되는, 유닛맵에 없는 특수 토큰 (엔진 기믹으로 처리). */
export const SPECIAL_REFS = new Set<string>(["larva"]);

export interface DanglingRef {
  unit: string;
  kind: "producedFrom" | "requires" | "morphedFrom";
  ref: string;
}

/** 존재하지 않는 id 를 참조하는 producedFrom/requires/morphedFrom 를 찾는다(오타 탐지). */
export function findDanglingRefs(full: PatchFull): DanglingRef[] {
  const ids = new Set(Object.keys(full.units));
  const out: DanglingRef[] = [];
  const check = (unit: string, kind: DanglingRef["kind"], refs: string[] | undefined) => {
    for (const ref of refs ?? []) {
      if (!ids.has(ref) && !SPECIAL_REFS.has(ref)) out.push({ unit, kind, ref });
    }
  };
  for (const [id, u] of Object.entries(full.units)) {
    check(id, "producedFrom", u.producedFrom);
    check(id, "requires", u.requires);
    check(id, "morphedFrom", u.morphedFrom ? [u.morphedFrom] : undefined);
  }
  return out;
}

/** 검증된 완전 패치 → 엔진용 PatchData 변환. */
export function toPatchData(full: PatchFull): PatchData {
  const units: Record<string, UnitDef> = {};
  for (const [id, u] of Object.entries(full.units)) {
    units[id] = {
      id,
      name: u.name,
      race: u.race,
      category: u.category,
      minerals: u.minerals,
      gas: u.gas,
      supply: u.supply,
      supplyProvided: u.supplyProvided,
      buildTime: u.buildTime,
      producedFrom: u.producedFrom,
      requires: u.requires,
      morphedFrom: u.morphedFrom,
      larvaCost: u.larvaCost,
      warpCooldown: u.warpCooldown,
      startCount: u.startCount,
      hidden: u.hidden,
      addon: u.addon,
      isWorker: u.category === "worker",
    };
  }
  return {
    id: full.version,
    name: full.name,
    harvest: full.harvest,
    start: full.start,
    base: full.base,
    warpInSeconds: full.warpInSeconds,
    larva: full.larva,
    units,
  };
}

/** 원본 패치 파일 목록 → 검증된 PatchData 목록 (릴리스일/버전 순). */
export function buildRegistry(rawFiles: PatchFile[]): PatchData[] {
  const byVersion = new Map<string, PatchFile>();
  for (const f of rawFiles) {
    if (byVersion.has(f.version)) throw new Error(`중복 패치 버전: ${f.version}`);
    byVersion.set(f.version, f);
  }
  return [...byVersion.keys()]
    .map((v) => toPatchData(resolvePatch(v, byVersion)))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

// ── 기본 레지스트리: patches/*.json 자동 로드 ─────────────────────────────
const modules = import.meta.glob<PatchFile>("./patches/*.json", {
  eager: true,
  import: "default",
});

export const RAW_PATCHES: PatchFile[] = Object.values(modules);
export const REGISTRY: PatchData[] = buildRegistry(RAW_PATCHES);

if (REGISTRY.length === 0) {
  throw new Error("로드된 패치가 없습니다 (src/lib/data/patches/*.json 확인).");
}

/** 최신(정렬상 마지막) 패치를 기본값으로. */
export const DEFAULT_PATCH: PatchData = REGISTRY[REGISTRY.length - 1];

export function getPatchById(id: string): PatchData {
  return REGISTRY.find((p) => p.id === id) ?? DEFAULT_PATCH;
}
