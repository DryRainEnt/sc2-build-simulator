import { derived, get, writable } from "svelte/store";
import type {
  BuildEvent,
  PatchData,
  Race,
  ResourceKind,
  SimulationResult,
} from "../engine/types";
import { simulate } from "../engine/simulate";
import { DEFAULT_PATCH, REGISTRY, getPatchById } from "../data/registry";

// localStorage 영속화 헬퍼 (없는 환경/오류는 안전 무시)
function loadLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function persist<T>(store: { subscribe: (fn: (v: T) => void) => unknown }, key: string): void {
  store.subscribe((v) => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  });
}

export type TabId = "unit" | "building" | "upgrade" | "action";
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
// 앱 기본 패치는 최신(정렬상 마지막). 테스트는 LOTV_PATCH(5.0.14) 별도 사용.
export const patch = writable<PatchData>(DEFAULT_PATCH);

export const factions = writable<Record<Side, FactionState>>({
  left: emptyFaction("terran"),
  right: emptyFaction("protoss"),
});

/** 선택된 건물 트랙(애드온 부착 대상). */
export const selectedTrack = writable<{ side: Side; machineId: string } | null>(null);

/** 배치된 마커 시각들 (양 진영 공유, 오름차순). */
export const markers = writable<number[]>([]);

/** 시간선 길이(초): 콘텐츠가 300초를 넘기면 600초로 확장. */
export const duration = derived([factions, markers], ([$f, $m]) => {
  let max = 0;
  for (const t of $m) if (t > max) max = t;
  for (const e of $f.left.events) if (e.time > max) max = e.time;
  for (const e of $f.right.events) if (e.time > max) max = e.time;
  return max > 280 ? 600 : 300;
});
/** 현재 선택된(활성) 마커 시각 — 유닛 클릭 시 생산이 배치되는 지점. */
export const currentMarker = writable<number | null>(null);
/** 시간선 커서가 가리키는 시각(초). null = 벗어남. */
export const hoverTime = writable<number | null>(null);

/** 표시 설정 (편의 토글). localStorage 영속. */
export const displaySettings = writable({
  showIdle: true, // 생산 건물 유휴 빗금
  showTech: true, // 테크 선행 경고 마커
  showLarva: true, // 저그 애벌레 그래프
  dark: false, // 다크 모드
  scale: 100, // UI 배율(%)
  ...loadLS<Record<string, unknown>>("scbs-display", {}),
});
persist(displaySettings, "scbs-display");

/** 사용자 커스텀 패치들 (localStorage 영속). */
export const customPatches = writable<PatchData[]>(loadLS<PatchData[]>("scbs-custom-patches", []));
persist(customPatches, "scbs-custom-patches");

/** 드롭다운에 보일 전체 패치 = 내장 + 커스텀. */
export const allPatches = derived(customPatches, ($c) => [...REGISTRY, ...$c]);

/** id로 패치 조회 (내장 + 커스텀). */
export function findPatch(id: string): PatchData {
  return get(customPatches).find((p) => p.id === id) ?? getPatchById(id);
}

/** 커스텀 패치 추가/교체 후 현재 패치로 선택. */
export function saveCustomPatch(p: PatchData): void {
  customPatches.update((list) => {
    const rest = list.filter((x) => x.id !== p.id);
    return [...rest, p];
  });
  patch.set(p);
}

/** 커스텀 패치 삭제. */
export function deleteCustomPatch(id: string): void {
  customPatches.update((list) => list.filter((p) => p.id !== id));
}

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

/** 건물 트랙 선택 토글 (애드온 부착 대상). */
export function selectTrack(side: Side, machineId: string): void {
  selectedTrack.update((cur) =>
    cur && cur.side === side && cur.machineId === machineId ? null : { side, machineId },
  );
}

/** 지정 건물에 애드온 부착 (현재 마커 시각). 건물당 1개 — 기존 애드온은 교체. */
export function queueAddon(
  side: Side,
  machineId: string,
  marker: number,
  addon: "reactor" | "tech_lab",
): void {
  factions.update((f) => {
    const evs = f[side].events.filter((e) => !(e.kind === "addon" && e.machineId === machineId));
    return {
      ...f,
      [side]: { ...f[side], events: [...evs, { time: Math.round(marker), kind: "addon", machineId, addon }] },
    };
  });
}

/** 지정 건물의 애드온 제거. */
export function removeAddon(side: Side, machineId: string): void {
  factions.update((f) => ({
    ...f,
    [side]: {
      ...f[side],
      events: f[side].events.filter((e) => !(e.kind === "addon" && e.machineId === machineId)),
    },
  }));
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

// ── 빌드 공유 코드 (패치/종족/빌드를 텍스트로 인코딩) ─────────────────────
// base64(UTF-8 JSON). 텍스트만 복붙하면 그대로 불러올 수 있다.

/** 현재 빌드를 공유 코드 문자열로 인코딩. */
export function encodeBuild(): string {
  const p = get(patch);
  const f = get(factions);
  const m = get(markers);
  const data = {
    v: 1,
    patch: p.id,
    L: { r: f.left.race, e: f.left.events },
    R: { r: f.right.race, e: f.right.events },
    m,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

/** 공유 코드에서 빌드를 불러온다. 성공하면 true. */
export function importBuild(code: string): boolean {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (data.v !== 1 || !data.L || !data.R) return false;
    // 패치를 못 찾으면(커스텀 미보유 등) 현재 패치 유지
    try {
      patch.set(findPatch(data.patch));
    } catch {
      /* keep current */
    }
    factions.set({
      left: { race: data.L.r, events: Array.isArray(data.L.e) ? data.L.e : [], activeTab: "unit" },
      right: { race: data.R.r, events: Array.isArray(data.R.e) ? data.R.e : [], activeTab: "unit" },
    });
    markers.set(Array.isArray(data.m) ? data.m : []);
    currentMarker.set(null);
    selectedTrack.set(null);
    return true;
  } catch {
    return false;
  }
}

// ── 패치 공유 코드 (커스텀 패치 내보내기/가져오기) ────────────────────────
export function encodePatch(p: PatchData): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}

export function importPatchCode(code: string): boolean {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as PatchData;
    if (!p || !p.id || !p.units || !p.harvest) return false;
    saveCustomPatch(p);
    return true;
  } catch {
    return false;
  }
}
