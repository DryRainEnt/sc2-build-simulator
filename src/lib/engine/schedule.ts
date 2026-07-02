import type { BuildEvent, PatchData, Race, UnitDef } from "./types";
import { computeLarva, isLarvaUnit } from "./larva";

// 생산 스케줄러 (Phase 1: 테란/프로토스 건물 슬롯).
//
// 각 생산 건물 인스턴스는 동시에 1기만 생산한다. 유닛 생산 요청은 필요한 건물 종류의
// 인스턴스 중 "가장 빨리 비는 곳"에 배정되고, 그 시각(가장 빠른 가능 시작)부터 생산된다.
// 자원/보급 소모는 주문(마커) 시점(엔진의 spend), 실제 생산은 여기서 계산한 start~end.
//
// 트랙 모델: 각 건물 인스턴스 = 고정 machineId("종류#idx", 생성 순서). 그 건물의 건설바와
// 거기서 나온 유닛들은 같은 machineId(=같은 열)를 공유한다.
//
// 규칙/근사:
// - 건물 건설(build_structure)은 슬롯 스케줄링 대상이 아님(일꾼 여유 가정) → 마커 시각 시작.
// - 변태 건물(morphedFrom)은 새 인스턴스를 추가하지 않음(기존 건물이 변형된 것).
// - 저그 애벌레·차원관문 쿨다운·리액터는 후속 Phase.

export interface ScheduledProd {
  eventIndex: number; // events 배열 내 원본 인덱스
  unitId: string;
  orderTime: number; // 주문(마커) 시각 = 자원 소모 시점
  start: number; // 실제 생산 시작 (슬롯 비는 시각)
  end: number; // 완료 = start + buildTime
  facility: string; // 사용/생성한 건물 종류 (무시설이면 "")
  machineId: string; // "종류#idx" (트랙/체인 식별, 무시설이면 "")
  isBuilding: boolean; // build_structure (슬롯 미대상, 마커에 시작)
}

const PRODUCED_KINDS = new Set(["train_unit", "train_worker", "build_structure"]);

interface Machine {
  id: string;
  type: string;
  freeTime: number; // 다음 생산 가능 시각(온라인 시각으로 초기화)
}

function findWorker(patch: PatchData, race: Race): UnitDef | undefined {
  return Object.values(patch.units).find((u) => u.isWorker && u.race === race);
}

function producedDef(e: BuildEvent, patch: PatchData, race: Race): UnitDef | undefined {
  if (e.kind === "train_worker") return findWorker(patch, race);
  if (e.kind === "train_unit" || e.kind === "build_structure") return patch.units[e.unitId];
  return undefined;
}

/** 어떤 유닛이라도 producedFrom 으로 참조하는 건물 종류 집합(=생산 시설). */
function facilityTypesOf(patch: PatchData): Set<string> {
  const set = new Set<string>();
  for (const u of Object.values(patch.units)) for (const f of u.producedFrom ?? []) set.add(f);
  return set;
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
  const facilityTypes = facilityTypesOf(patch);

  const machinesByType = new Map<string, Machine[]>();
  const nextIdx = new Map<string, number>();
  const createMachine = (type: string, online: number): Machine => {
    const idx = nextIdx.get(type) ?? 0;
    nextIdx.set(type, idx + 1);
    const m: Machine = { id: `${type}#${idx}`, type, freeTime: online };
    const arr = machinesByType.get(type);
    if (arr) arr.push(m);
    else machinesByType.set(type, [m]);
    return m;
  };

  // 시작 보유 생산시설(해당 종족 본진) → t=0 온라인
  for (const u of Object.values(patch.units)) {
    if (!facilityTypes.has(u.id) || u.race !== race) continue;
    for (let k = 0; k < (u.startCount ?? 0); k++) createMachine(u.id, 0);
  }

  // 저그 애벌레 풀(라바 유닛 시작 시각 계산)
  const larva = computeLarva(events, patch, race);
  // 건설되는 생산시설(변태 제외) → 건설 완료 시각에 온라인. 건설바에 machineId 연결
  const buildMachineId = new Map<number, string>();
  events.forEach((e, i) => {
    if (e.kind !== "build_structure") return;
    const def = patch.units[e.unitId];
    if (!def || def.morphedFrom || !facilityTypes.has(e.unitId)) return;
    const m = createMachine(e.unitId, e.time + def.buildTime);
    buildMachineId.set(i, m.id);
  });

  // 리액터: 호환 생산건물(barracks/factory/starport)에 자동 부착 → 동시 2기(2번째 슬롯).
  // 리액터 완성 시각에, 아직 리액터 없는 가장 이른 호환 건물에 붙는다.
  const reactorDef = patch.units["reactor"];
  if (reactorDef) {
    const reactored = new Set<string>();
    const reactors = events
      .filter((e): e is Extract<BuildEvent, { kind: "build_structure" }> =>
        e.kind === "build_structure" && (e as { unitId: string }).unitId === "reactor",
      )
      .map((e) => e.time + reactorDef.buildTime)
      .sort((a, b) => a - b);
    for (const completion of reactors) {
      let target: Machine | undefined;
      for (const type of reactorDef.producedFrom ?? []) {
        target = (machinesByType.get(type) ?? []).find((m) => !reactored.has(m.id));
        if (target) break;
      }
      if (!target) continue;
      reactored.add(target.id);
      const arr = machinesByType.get(target.type)!;
      arr.push({ id: `${target.id}·R`, type: target.type, freeTime: Math.max(completion, target.freeTime) });
    }
  }

  // 생산 이벤트를 큐 순서(주문 시각, 동시간은 원본 순서)로 배정
  const prod = events
    .map((e, i) => ({ e, i }))
    .filter((x) => PRODUCED_KINDS.has(x.e.kind))
    .sort((a, b) => a.e.time - b.e.time || a.i - b.i);

  const out: ScheduledProd[] = [];
  for (const { e, i } of prod) {
    const def = producedDef(e, patch, race);
    if (!def) continue;

    if (e.kind === "build_structure") {
      const machineId = buildMachineId.get(i) ?? "";
      out.push({
        eventIndex: i,
        unitId: def.id,
        orderTime: e.time,
        start: e.time,
        end: e.time + def.buildTime,
        facility: machineId ? def.id : "",
        machineId,
        isBuilding: true,
      });
      continue;
    }

    // 저그 라바 유닛: 건물 슬롯이 아니라 애벌레 풀에서 소모 → 애벌레 확보 시각에 시작
    if (isLarvaUnit(def)) {
      const start = larva.startTimes.get(i) ?? e.time;
      out.push({
        eventIndex: i,
        unitId: def.id,
        orderTime: e.time,
        start,
        end: start + def.buildTime,
        facility: "larva",
        machineId: "",
        isBuilding: false,
      });
      continue;
    }

    // 유닛/일꾼: producedFrom 인스턴스 중 가장 빨리 시작 가능한 곳 (생성 순서로 타이브레이크)
    let best: { machine: Machine; start: number } | null = null;
    for (const type of def.producedFrom ?? []) {
      for (const m of machinesByType.get(type) ?? []) {
        const start = Math.max(e.time, m.freeTime);
        if (!best || start < best.start) best = { machine: m, start };
      }
    }

    if (!best) {
      // 생산 시설 없음 → 마커 시각에 시작(테크 경고가 별도 표시)
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
    best.machine.freeTime = end;
    out.push({
      eventIndex: i,
      unitId: def.id,
      orderTime: e.time,
      start,
      end,
      facility: best.machine.type,
      machineId: best.machine.id,
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
