import type { BuildEvent, PatchData, Race, UnitDef } from "./types";

// 저그 애벌레 풀 (Phase 2).
//
// 모델(근사): 진영당 하나의 애벌레 풀. 용량 = perBase × 기지수, 재생 = 기지수/spawn (초당).
// 라바 유닛 생산은 애벌레를 소모(기본 1, 저글링 0.5). 애벌레가 부족하면 다음 재생까지 대기.
// - 기지 = 부화장/둥지/군락. 시작 부화장 1(zerg) + 건설 부화장(변태 제외). 둥지/군락은 변태라 기지수 불변.
// - 퀸 인젝트는 후속(Phase 3).

const DEFAULT_SPAWN = 9.9;
const DEFAULT_PER_BASE = 3;

export interface LarvaResult {
  /** 라바 소비 이벤트 eventIndex → 애벌레 확보되어 생산 시작하는 시각. */
  startTimes: Map<number, number>;
  /** 표시용 애벌레 수 계단점(정렬). */
  breakpoints: { t: number; larva: number }[];
  /** 임의 시점 애벌레 수(연속). */
  larvaAt: (t: number) => number;
}

export function isLarvaUnit(def: Pick<UnitDef, "producedFrom" | "morphedFrom">): boolean {
  return (def.producedFrom?.includes("larva") ?? false) || def.morphedFrom === "larva";
}

const EMPTY: LarvaResult = { startTimes: new Map(), breakpoints: [], larvaAt: () => 0 };

export function computeLarva(events: BuildEvent[], patch: PatchData, race: Race): LarvaResult {
  if (race !== "zerg") return EMPTY;

  const spawn = patch.larva?.spawnSeconds ?? DEFAULT_SPAWN;
  const perBase = patch.larva?.perBase ?? DEFAULT_PER_BASE;

  // 기지수 계단: 시작 부화장 1 + 건설 부화장(변태 제외) 완료 시각
  const steps: { t: number; bases: number }[] = [];
  const changes: number[] = [0]; // 시작 부화장
  for (const e of events) {
    if (e.kind !== "build_structure") continue;
    const def = patch.units[e.unitId];
    if (!def || def.id !== "hatchery" || def.morphedFrom) continue;
    changes.push(e.time + def.buildTime);
  }
  changes.sort((a, b) => a - b);
  let acc = 0;
  for (const t of changes) {
    acc += 1;
    if (steps.length && steps[steps.length - 1].t === t) steps[steps.length - 1].bases = acc;
    else steps.push({ t, bases: acc });
  }
  const basesAt = (t: number): number => {
    let b = 0;
    for (const s of steps) {
      if (s.t <= t) b = s.bases;
      else break;
    }
    return b;
  };
  const stepTimes = steps.map((s) => s.t);

  // lastT..toT 구간을 기지수 변화로 나눠 애벌레 재생 적분
  let larva = perBase; // 시작 부화장 3
  let lastT = 0;
  const advance = (toT: number) => {
    if (toT <= lastT) return;
    const pts = [lastT, ...stepTimes.filter((t) => t > lastT && t < toT), toT];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const bases = basesAt(a + 1e-9);
      const cap = perBase * bases;
      if (bases > 0 && larva < cap) larva = Math.min(cap, larva + (bases / spawn) * (b - a));
    }
    lastT = toT;
  };

  const breakpoints: { t: number; larva: number }[] = [{ t: 0, larva }];
  const startTimes = new Map<number, number>();

  const larvaEvents = events
    .map((e, i) => ({ e, i }))
    .filter((x) => {
      if (x.e.kind !== "train_unit") return false;
      const d = patch.units[x.e.unitId];
      return !!d && isLarvaUnit(d);
    })
    .sort((a, b) => a.e.time - b.e.time || a.i - b.i);

  for (const { e, i } of larvaEvents) {
    const def = patch.units[(e as { unitId: string }).unitId]!;
    const cost = def.larvaCost ?? 1;
    advance(e.time);
    let start = e.time;
    if (larva < cost) {
      const bases = basesAt(e.time);
      if (bases > 0) {
        start = e.time + ((cost - larva) * spawn) / bases;
        advance(start); // 애벌레가 cost 에 도달
      }
    }
    larva = Math.max(0, larva - cost);
    lastT = start;
    startTimes.set(i, start);
    breakpoints.push({ t: start, larva });
  }
  breakpoints.sort((a, b) => a.t - b.t);

  const larvaAt = (t: number): number => {
    let base = breakpoints[0];
    for (const bp of breakpoints) {
      if (bp.t <= t) base = bp;
      else break;
    }
    let l = base.larva;
    const pts = [base.t, ...stepTimes.filter((x) => x > base.t && x < t), t];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const bases = basesAt(a + 1e-9);
      const cap = perBase * bases;
      if (bases > 0 && l < cap) l = Math.min(cap, l + (bases / spawn) * (b - a));
    }
    return l;
  };

  return { startTimes, breakpoints, larvaAt };
}
