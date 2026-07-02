import { derived, writable } from "svelte/store";
import type {
  BuildEvent,
  PatchData,
  Race,
  ResourceKind,
  SimulationResult,
} from "../engine/types";
import { simulate } from "../engine/simulate";
import { LOTV_PATCH } from "../data/lotv";
import { DEFAULT_DURATION } from "../config";

export type TabId = "unit" | "building" | "action";
export type Side = "left" | "right";

export interface FactionState {
  race: Race;
  events: BuildEvent[];
  activeTab: TabId;
}

function emptyFaction(race: Race): FactionState {
  return { race, events: [], activeTab: "unit" };
}

// ── 스토어 ─────────────────────────────────────────────────────────────
export const patch = writable<PatchData>(LOTV_PATCH);
export const duration = writable<number>(DEFAULT_DURATION);

export const factions = writable<Record<Side, FactionState>>({
  left: emptyFaction("terran"),
  right: emptyFaction("protoss"),
});

/** 배치된 마커 시각들 (양 진영 공유, 오름차순). */
export const markers = writable<number[]>([]);
/** 현재 선택된(활성) 마커 시각 — 유닛 클릭 시 생산이 배치되는 지점. */
export const currentMarker = writable<number | null>(null);
/** 시간선 커서가 가리키는 시각(초). null = 벗어남. */
export const hoverTime = writable<number | null>(null);

// ── 파생: 각 진영 시뮬레이션 결과 ────────────────────────────────────────
export const sims = derived(
  [factions, patch, duration],
  ([$f, $p, $d]): Record<Side, SimulationResult> => ({
    left: simulate($f.left.events, $p, { duration: $d, race: $f.left.race }),
    right: simulate($f.right.events, $p, { duration: $d, race: $f.right.race }),
  }),
);

// ── 액션 ───────────────────────────────────────────────────────────────
export function setRace(side: Side, race: Race): void {
  factions.update((f) => ({ ...f, [side]: { ...f[side], race, events: [] } }));
}

export function setTab(side: Side, tab: TabId): void {
  factions.update((f) => ({ ...f, [side]: { ...f[side], activeTab: tab } }));
}

export function addEvent(side: Side, event: BuildEvent): void {
  factions.update((f) => ({
    ...f,
    [side]: { ...f[side], events: [...f[side].events, event] },
  }));
}

export function removeEventsAt(side: Side, time: number): void {
  factions.update((f) => ({
    ...f,
    [side]: { ...f[side], events: f[side].events.filter((e) => e.time !== time) },
  }));
}

/** 특정 시각의 특정 종류 이벤트 1개만 제거 (칩 클릭 편집용). */
export function removeOneEvent(
  side: Side,
  time: number,
  kind: BuildEvent["kind"],
  unitId?: string,
): void {
  factions.update((f) => {
    const evs = [...f[side].events];
    const i = evs.findIndex(
      (e) =>
        e.time === time &&
        e.kind === kind &&
        (unitId === undefined || (e as { unitId?: string }).unitId === unitId),
    );
    if (i >= 0) evs.splice(i, 1);
    return { ...f, [side]: { ...f[side], events: evs } };
  });
}

/** 시간선 클릭: 마커는 항상 하나만 존재 — 새 위치로 이동(교체). */
export function placeMarker(time: number): void {
  const t = Math.round(time);
  markers.set([t]);
  currentMarker.set(t);
}

export function selectMarker(time: number): void {
  currentMarker.set(time);
}

export function removeMarker(time: number): void {
  markers.update((m) => m.filter((t) => t !== time));
  currentMarker.update((c) => (c === time ? null : c));
}

/** 유닛/건물 생산을 현재 마커 시각에 추가 (중복 클릭 = 큐 중첩). */
export function queueProduction(side: Side, unitId: string, marker: number, isStructure: boolean): void {
  addEvent(side, {
    time: marker,
    kind: isStructure ? "build_structure" : "train_unit",
    unitId,
  });
}

export function queueWorker(side: Side, marker: number): void {
  addEvent(side, { time: marker, kind: "train_worker" });
}

export function queueAssign(side: Side, marker: number, workers: number, to: ResourceKind): void {
  addEvent(side, { time: marker, kind: "assign_worker", workers, to });
}

export function queueTransfer(side: Side, marker: number, workers: number, dur: number): void {
  addEvent(side, { time: marker, kind: "worker_transfer", workers, duration: dur });
}

export function queueDeath(side: Side, marker: number, unitId: string, count: number): void {
  addEvent(side, { time: marker, kind: "unit_death", unitId, count });
}

export function queueInject(side: Side, marker: number): void {
  addEvent(side, { time: marker, kind: "inject" });
}

/** 채취정지 이벤트의 지속시간 변경 (끝 노드 드래그). 최소 1초. */
export function setPauseDuration(side: Side, index: number, duration: number): void {
  factions.update((f) => {
    const evs = [...f[side].events];
    const e = evs[index];
    if (e && e.kind === "worker_transfer") {
      evs[index] = { ...e, duration: Math.max(1, Math.round(duration)) };
    }
    return { ...f, [side]: { ...f[side], events: evs } };
  });
}

/** 여러 이벤트의 시각을 한 번에 설정 (큐 블록 드래그 이동). 최소 0초. */
export function setEventTimes(side: Side, updates: { index: number; time: number }[]): void {
  factions.update((f) => {
    const evs = [...f[side].events];
    for (const { index, time } of updates) {
      if (evs[index]) evs[index] = { ...evs[index], time: Math.max(0, Math.round(time)) };
    }
    return { ...f, [side]: { ...f[side], events: evs } };
  });
}

/** 인덱스로 이벤트 1개 제거 (기간 막대 등 특정 이벤트 지정 삭제). */
export function removeEventByIndex(side: Side, index: number): void {
  factions.update((f) => {
    const evs = [...f[side].events];
    if (index >= 0 && index < evs.length) evs.splice(index, 1);
    return { ...f, [side]: { ...f[side], events: evs } };
  });
}
