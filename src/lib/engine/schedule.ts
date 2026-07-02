import type { BuildEvent, PatchData, Race, UnitDef } from "./types";

// 생산 스케줄러 (Phase 1: 테란/프로토스 건물 슬롯).
//
// 각 생산 건물 인스턴스는 동시에 1기만 생산한다. 유닛 생산 요청은 필요한 건물 종류의
// 인스턴스 중 "가장 빨리 비는 곳"에 배정되고, 그 시각(가장 빠른 가능 시작)부터 생산된다.
// 자원/보급 소모는 주문(마커) 시점(엔진의 spend), 실제 생산은 여기서 계산한 start~end.
//
// 규칙/근사:
// - 건물 건설(build_structure)은 슬롯 스케줄링 대상이 아님(일꾼은 여유 있다고 가정) → 마커 시각에 시작.
// - 변태 건물(morphedFrom)은 새 인스턴스를 추가하지 않음(기존 건물이 변형된 것).
// - 저그 애벌레(morphedFrom "larva")·차원관문 쿨다운·리액터는 후속 Phase.

export interface ScheduledProd {
  eventIndex: number; // events 배열 내 원본 인덱스
  unitId: string;
  orderTime: number; // 주문(마커) 시각 = 자원 소모 시점
  start: number; // 실제 생산 시작 (슬롯 비는 시각)
  end: number; // 완료 = start + buildTime
  facility: string; // 사용한 건물 종류 (건물/무시설이면 "")
  machineId: string; // "종류#인덱스" (체인/드래그 식별용, 없으면 "")
  isBuilding: boolean; // build_structure (슬롯 미대상, 마커에 시작)
}

const PRODUCED_KINDS = new Set(["train_unit", "train_worker", "build_structure"]);

function findWorker(patch: PatchData, race: Race): UnitDef | undefined {
  return Object.values(patch.units).find((u) => u.isWorker && u.race === race);
}

function producedDef(e: BuildEvent, patch: PatchData, race: Race): UnitDef | undefined {
  if (e.kind === "train_worker") return findWorker(patch, race);
  if (e.kind === "train_unit" || e.kind === "build_structure") return patch.units[e.unitId];
  return undefined;
}

/**
 * 생산 이벤트들의 실제 시작/완료 시각을 계산.
 * @returns 원본 이벤트 순서(eventIndex 오름차순)로 정렬된 스케줄 결과
 */
export function scheduleProduction(
  events: BuildEvent[],
  patch: PatchData,
  race: Race = "terran",
): ScheduledProd[] {
  // 1) 건물 인스턴스가 온라인되는 시각(= 생산 가능 시작 가능 시각) 수집
  const machines = new Map<string, number[]>(); // 종류 → 각 인스턴스의 현재 free 시각
  const addMachine = (type: string, freeAt: number) => {
    const arr = machines.get(type);
    if (arr) arr.push(freeAt);
    else machines.set(type, [freeAt]);
  };
  // 시작 보유 건물(본진 등)
  for (const u of Object.values(patch.units)) {
    for (let k = 0; k < (u.startCount ?? 0); k++) addMachine(u.id, 0);
  }
  // 건설되는 건물 (변태 제외 — 새 슬롯 아님)
  events.forEach((e) => {
    if (e.kind !== "build_structure") return;
    const def = patch.units[e.unitId];
    if (!def || def.morphedFrom) return;
    addMachine(e.unitId, e.time + def.buildTime);
  });
  // 인스턴스별 free 시각 오름차순 (안정적 배정)
  for (const arr of machines.values()) arr.sort((a, b) => a - b);

  // 2) 생산 이벤트를 큐 순서(주문 시각, 동시간은 원본 순서)로 배정
  const prod = events
    .map((e, i) => ({ e, i }))
    .filter((x) => PRODUCED_KINDS.has(x.e.kind))
    .sort((a, b) => a.e.time - b.e.time || a.i - b.i);

  const out: ScheduledProd[] = [];
  for (const { e, i } of prod) {
    const def = producedDef(e, patch, race);
    if (!def) continue;

    if (e.kind === "build_structure") {
      out.push({
        eventIndex: i,
        unitId: def.id,
        orderTime: e.time,
        start: e.time,
        end: e.time + def.buildTime,
        facility: "",
        machineId: "",
        isBuilding: true,
      });
      continue;
    }

    // 유닛/일꾼: producedFrom 건물 인스턴스 중 가장 빨리 시작 가능한 곳
    let best: { type: string; idx: number; start: number } | null = null;
    for (const type of def.producedFrom ?? []) {
      const arr = machines.get(type);
      if (!arr) continue;
      for (let mi = 0; mi < arr.length; mi++) {
        const start = Math.max(e.time, arr[mi]);
        if (!best || start < best.start) best = { type, idx: mi, start };
      }
    }

    if (!best) {
      // 생산 건물이 없음 → 마커 시각에 시작(테크 경고가 별도로 표시)
      out.push({
        eventIndex: i,
        unitId: def.id,
        orderTime: e.time,
        start: e.time,
        end: e.time + def.buildTime,
        facility: "",
        machineId: "",
        isBuilding: false,
      });
      continue;
    }

    const start = best.start;
    const end = start + def.buildTime;
    machines.get(best.type)![best.idx] = end;
    out.push({
      eventIndex: i,
      unitId: def.id,
      orderTime: e.time,
      start,
      end,
      facility: best.type,
      machineId: `${best.type}#${best.idx}`,
      isBuilding: false,
    });
  }

  out.sort((a, b) => a.eventIndex - b.eventIndex);
  return out;
}

/** eventIndex → ScheduledProd 조회용 맵. */
export function scheduleByIndex(sched: ScheduledProd[]): Map<number, ScheduledProd> {
  return new Map(sched.map((s) => [s.eventIndex, s]));
}
