import type { BuildEvent, PatchData } from "./engine/types";

// 배치된 빌드 이벤트를 "시각별 라벨 칩"으로 요약한다 (시간선에 표시·편집용).
// 같은 시각의 동일 항목은 하나의 칩으로 묶고 개수를 센다(생산 큐 중첩 시각화).

export interface BuildChipItem {
  label: string;
  count: number;
  kind: BuildEvent["kind"];
  unitId?: string;
}

export interface BuildChipGroup {
  time: number;
  items: BuildChipItem[];
}

function describe(e: BuildEvent, patch: PatchData): { key: string; label: string; unitId?: string } {
  switch (e.kind) {
    case "train_worker":
      return { key: "worker", label: "일꾼" };
    case "train_unit":
    case "build_structure": {
      const name = patch.units[e.unitId]?.name ?? e.unitId;
      return { key: `u:${e.unitId}`, label: name, unitId: e.unitId };
    }
    case "assign_worker":
      return {
        key: `assign:${e.to}:${e.workers}`,
        label:
          e.workers === 1
            ? `${e.to === "gas" ? "가스" : "미네랄"} 일꾼`
            : `${e.to === "gas" ? "가스" : "미네랄"} 일꾼 ${e.workers}`,
      };
    case "worker_transfer":
      return {
        key: `pause:${e.workers}:${e.duration}`,
        label: `채취정지 ${e.workers}기/${e.duration}s`,
      };
    case "unit_death": {
      const name = patch.units[e.unitId]?.name ?? (e.unitId === "worker" ? "일꾼" : e.unitId);
      return { key: `death:${e.unitId}`, label: `${name} 사망`, unitId: e.unitId };
    }
  }
}

// ── 기간 막대 (시작→완료 범위 표시) ─────────────────────────────────────
// 생산/건설 = 아이콘+완료원, 채취정지 = 드래그 가능한 정지 구간.
export interface TimelineBar {
  kind: "prod" | "pause";
  time: number; // 시작 시각
  end: number; // 완료/해제 시각
  lane: number; // 겹침 회피용 가로 레인(0=중앙축에 가장 가까움)
  // prod 전용
  label?: string;
  unitId?: string;
  count?: number;
  // pause 전용
  eventIndex?: number; // faction.events 내 원본 인덱스(드래그/삭제용)
  workers?: number;
}

/** ProdBar는 하위호환용 별칭 (prod 막대만). */
export type ProdBar = Required<Pick<TimelineBar, "time" | "end" | "label" | "unitId" | "count" | "lane">>;

const PROD_KINDS = new Set(["train_unit", "build_structure"]);

/** 시간 구간이 겹치는 막대를 서로 다른 레인에 배치(그리디 구간 분할). */
function packLanes<T extends { time: number; end: number; lane: number }>(items: T[]): T[] {
  const sorted = items.sort((a, b) => a.time - b.time || a.end - b.end);
  const laneEnds: number[] = [];
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= it.time);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    it.lane = lane;
  }
  return sorted;
}

/** 생산/건설 이벤트를 (시각,유닛)별로 묶어 막대 후보로. */
function prodGroups(events: BuildEvent[], patch: PatchData): TimelineBar[] {
  const groups = new Map<string, TimelineBar>();
  for (const e of events) {
    if (!PROD_KINDS.has(e.kind)) continue;
    const unitId = (e as { unitId: string }).unitId;
    const def = patch.units[unitId];
    if (!def) continue;
    const key = `${e.time}|${unitId}`;
    const g = groups.get(key);
    if (g) g.count! += 1;
    else
      groups.set(key, {
        kind: "prod",
        time: e.time,
        end: e.time + def.buildTime,
        label: def.name,
        unitId,
        count: 1,
        lane: 0,
      });
  }
  return [...groups.values()];
}

/** 생산 막대만 (하위호환·테스트용). */
export function productionLayout(events: BuildEvent[], patch: PatchData): ProdBar[] {
  return packLanes(prodGroups(events, patch)) as ProdBar[];
}

/** 생산 막대 + 채취정지 막대를 한 레인 체계로 함께 배치(서로 겹치지 않음). */
export function timelineBars(events: BuildEvent[], patch: PatchData): TimelineBar[] {
  const pauses: TimelineBar[] = [];
  events.forEach((e, i) => {
    if (e.kind === "worker_transfer") {
      pauses.push({
        kind: "pause",
        time: e.time,
        end: e.time + e.duration,
        lane: 0,
        eventIndex: i,
        workers: e.workers,
      });
    }
  });
  return packLanes([...prodGroups(events, patch), ...pauses]);
}

export function summarizeBuild(events: BuildEvent[], patch: PatchData): BuildChipGroup[] {
  const byTime = new Map<number, Map<string, BuildChipItem>>();
  for (const e of events) {
    const { key, label, unitId } = describe(e, patch);
    let m = byTime.get(e.time);
    if (!m) {
      m = new Map();
      byTime.set(e.time, m);
    }
    const existing = m.get(key);
    if (existing) existing.count += 1;
    else m.set(key, { label, count: 1, kind: e.kind, unitId });
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, m]) => ({ time, items: [...m.values()] }));
}
