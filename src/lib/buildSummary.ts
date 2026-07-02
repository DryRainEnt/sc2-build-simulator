import type { BuildEvent, PatchData, Race } from "./engine/types";
import { scheduleProduction } from "./engine/schedule";

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
    case "inject":
      return { key: "inject", label: "인젝트" };
    case "addon":
      return { key: `addon:${e.machineId}`, label: "반응로" };
  }
}

// ── 기간 막대 (실제 시작→완료 범위 표시) ────────────────────────────────
// 생산/건설 = 아이콘(시작)+완료원, 채취정지 = 드래그 가능한 정지 구간.
// 생산 시작은 스케줄러(슬롯 배정)로 계산 — 건물 바쁘면 마커보다 아래로 밀림.
export interface TimelineBar {
  kind: "prod" | "pause" | "addon";
  start: number; // 막대 시작 시각(prod: 실제 생산 시작, pause: 정지 시작)
  end: number; // 막대 끝 시각
  orderTime: number; // 주문(마커) 시각 = 자원 소모 지점
  lane: number; // 겹침 회피용 가로 레인(0=중앙축에 가장 가까움)
  eventIndex: number; // faction.events 내 원본 인덱스(삭제/드래그용)
  // prod 전용
  label?: string;
  unitId?: string;
  machineId?: string; // "종류#idx" (같은 건물 큐 체인 식별)
  isBuilding?: boolean;
  // pause 전용
  workers?: number;
}

/** 시간 구간이 겹치는 막대를 서로 다른 레인에 배치(그리디). base부터 레인 인덱스 부여. */
function packLanes<T extends { start: number; end: number; lane: number }>(items: T[], base = 0): T[] {
  const sorted = items.sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    it.lane = base + lane;
  }
  return sorted;
}

/** 건물 트랙(열) 메타데이터 — 헤더/애드온 UI용. */
export interface FacilityTrack {
  machineId: string;
  type: string;
  lane: number; // 기준(가장 안쪽) 레인
  laneCount: number; // 열 폭(1, 반응로는 2)
  onlineTime: number; // 건설 완료(또는 0=시작보유)
  hasReactor: boolean;
  hasTechLab: boolean;
}

export interface TimelineLayout {
  bars: TimelineBar[];
  tracks: FacilityTrack[];
}

/**
 * 생산(스케줄) + 채취정지를 트랙 모델로 배치.
 * - 각 생산 건물 인스턴스(machineId)에 고정 열. 반응로가 붙어 동시 2기면 열이 2줄로 벌어짐.
 * - 무시설(폴백)·비생산 건물·정지는 건물 열 뒤쪽 레인에 겹침 회피 packing.
 */
export function layoutTimeline(events: BuildEvent[], patch: PatchData, race: Race = "terran"): TimelineLayout {
  const sched = scheduleProduction(events, patch, race);
  const reactored = new Set<string>();
  const techLabbed = new Set<string>();
  for (const e of events) {
    if (e.kind !== "addon") continue;
    if (e.addon === "reactor") reactored.add(e.machineId);
    else if (e.addon === "tech_lab") techLabbed.add(e.machineId);
  }

  const facMap = new Map<string, TimelineBar[]>();
  const miscBars: TimelineBar[] = [];
  for (const s of sched) {
    const bar: TimelineBar = {
      kind: "prod",
      start: s.start,
      end: s.end,
      orderTime: s.orderTime,
      lane: 0,
      eventIndex: s.eventIndex,
      label: patch.units[s.unitId]?.name ?? s.unitId,
      unitId: s.unitId,
      machineId: s.machineId,
      isBuilding: s.isBuilding,
    };
    if (s.machineId) {
      const arr = facMap.get(s.machineId);
      if (arr) arr.push(bar);
      else facMap.set(s.machineId, [bar]);
    } else miscBars.push(bar);
  }

  // 애드온(반응로/기술실) 건설 막대 — 대상 건물 열에 배치
  events.forEach((e, i) => {
    if (e.kind !== "addon") return;
    const def = patch.units[e.addon];
    if (!def) return;
    const bar: TimelineBar = {
      kind: "addon",
      start: e.time,
      end: e.time + def.buildTime,
      orderTime: e.time,
      lane: 0,
      eventIndex: i,
      label: def.name,
      unitId: e.addon,
      machineId: e.machineId,
      isBuilding: false,
    };
    const arr = facMap.get(e.machineId);
    if (arr) arr.push(bar);
    else facMap.set(e.machineId, [bar]);
  });

  // 건물별 첫 등장 시각 순으로 열 할당 (반응로면 2줄 예약)
  const firstStart = (mid: string) => Math.min(...facMap.get(mid)!.map((b) => b.start));
  const machineIds = [...facMap.keys()].sort((a, b) => firstStart(a) - firstStart(b) || a.localeCompare(b));

  const facilityBars: TimelineBar[] = [];
  const tracks: FacilityTrack[] = [];
  let cursor = 0;
  for (const mid of machineIds) {
    const mbars = facMap.get(mid)!;
    packLanes(mbars, 0); // 건물 내부 서브레인(순차면 1, 동시2기면 2)
    const subLanes = mbars.reduce((m, b) => Math.max(m, b.lane), 0) + 1;
    const hasReactor = reactored.has(mid);
    const laneCount = Math.max(subLanes, hasReactor ? 2 : 1);
    for (const b of mbars) {
      b.lane += cursor;
      facilityBars.push(b);
    }
    const construction = mbars.find((b) => b.isBuilding);
    tracks.push({
      machineId: mid,
      type: mid.split("#")[0],
      lane: cursor,
      laneCount,
      onlineTime: construction ? construction.end : 0,
      hasReactor,
      hasTechLab: techLabbed.has(mid),
    });
    cursor += laneCount;
  }

  events.forEach((e, i) => {
    if (e.kind === "worker_transfer") {
      miscBars.push({
        kind: "pause",
        start: e.time,
        end: e.time + e.duration,
        orderTime: e.time,
        lane: 0,
        eventIndex: i,
        workers: e.workers,
      });
    }
  });
  packLanes(miscBars, cursor); // 건물 열 뒤쪽부터

  return { bars: [...facilityBars, ...miscBars], tracks };
}

export function timelineBars(events: BuildEvent[], patch: PatchData, race: Race = "terran"): TimelineBar[] {
  return layoutTimeline(events, patch, race).bars;
}

export function facilityTracks(events: BuildEvent[], patch: PatchData, race: Race = "terran"): FacilityTrack[] {
  return layoutTimeline(events, patch, race).tracks;
}

export interface IdleBand {
  lane: number;
  start: number;
  end: number;
}

/**
 * 생산 건물이 노는(유휴) 구간 — 온라인(건설 완료/시작) 이후 마지막 생산 전까지의 빈 시간.
 * 각 건물 트랙별로 계산. minGap 이상만 반환.
 */
export function idleIntervals(bars: TimelineBar[], minGap = 1): IdleBand[] {
  const byMachine = new Map<string, TimelineBar[]>();
  for (const b of bars) {
    if (b.kind !== "prod" || !b.machineId) continue;
    const arr = byMachine.get(b.machineId);
    if (arr) arr.push(b);
    else byMachine.set(b.machineId, [b]);
  }
  const out: IdleBand[] = [];
  for (const mbars of byMachine.values()) {
    const lane = mbars[0].lane;
    const construction = mbars.find((b) => b.isBuilding);
    const online = construction ? construction.end : 0;
    const prod = mbars.filter((b) => !b.isBuilding).sort((a, b) => a.start - b.start);
    if (!prod.length) continue;
    let cursor = online;
    for (const b of prod) {
      if (b.start - cursor >= minGap) out.push({ lane, start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
  }
  return out;
}

/**
 * 드래그 이동 대상 = 대상 막대 + 같은 건물에서 틈 없이(back-to-back) 뒤에 붙은 생산들.
 * @returns 이동할 이벤트들의 eventIndex 배열
 */
export function contiguousBlock(bars: TimelineBar[], bar: TimelineBar): number[] {
  const EPS = 0.01;
  if (!bar.machineId) return [bar.eventIndex];
  const chain = bars
    .filter((b) => b.kind === "prod" && b.machineId === bar.machineId)
    .sort((a, b) => a.start - b.start);
  const at = chain.findIndex((b) => b.eventIndex === bar.eventIndex);
  if (at < 0) return [bar.eventIndex];
  const block = [chain[at].eventIndex];
  let prevEnd = chain[at].end;
  for (let j = at + 1; j < chain.length; j++) {
    if (chain[j].start <= prevEnd + EPS) {
      block.push(chain[j].eventIndex);
      prevEnd = chain[j].end;
    } else break;
  }
  return block;
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
