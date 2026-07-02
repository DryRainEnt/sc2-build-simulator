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

// ── 생산 기간 막대 (시작→완료 범위 표시) ────────────────────────────────
export interface ProdBar {
  time: number; // 시작(주문) 시각
  end: number; // 완료 시각 = 시작 + buildTime
  label: string;
  unitId: string;
  count: number; // 같은 시각·같은 유닛 중첩 수
  lane: number; // 겹침 회피용 가로 레인 인덱스(0=중앙축에 가장 가까움)
}

const PROD_KINDS = new Set(["train_unit", "build_structure"]);

/**
 * 생산/건설 이벤트를 시작→완료 기간 막대로 배치.
 * 같은 (시각, 유닛)은 하나로 묶어 개수를 센다.
 * 시간 구간이 겹치는 막대는 서로 다른 레인에 배치(그리디 구간 분할).
 */
export function productionLayout(events: BuildEvent[], patch: PatchData): ProdBar[] {
  const groups = new Map<string, ProdBar>();
  for (const e of events) {
    if (!PROD_KINDS.has(e.kind)) continue;
    const unitId = (e as { unitId: string }).unitId;
    const def = patch.units[unitId];
    if (!def) continue;
    const key = `${e.time}|${unitId}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else
      groups.set(key, {
        time: e.time,
        end: e.time + def.buildTime,
        label: def.name,
        unitId,
        count: 1,
        lane: 0,
      });
  }

  const bars = [...groups.values()].sort((a, b) => a.time - b.time || a.end - b.end);
  const laneEnds: number[] = []; // 각 레인의 현재 점유 종료 시각
  for (const bar of bars) {
    let lane = laneEnds.findIndex((end) => end <= bar.time);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.end);
    } else {
      laneEnds[lane] = bar.end;
    }
    bar.lane = lane;
  }
  return bars;
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
