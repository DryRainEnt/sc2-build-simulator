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
        label: `${e.to === "gas" ? "가스" : "미네랄"} 배치 ${e.workers}`,
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
