import { describe, it, expect } from "vitest";
import { scheduleProduction } from "./schedule";
import { LOTV_PATCH } from "../data/lotv";
import type { BuildEvent } from "./types";

const byId = (sched: ReturnType<typeof scheduleProduction>, unitId: string) =>
  sched.filter((s) => s.unitId === unitId);

describe("scheduleProduction — 생산 슬롯 스케줄러", () => {
  it("건물 건설은 슬롯 대상이 아니라 마커 시각에 시작", () => {
    const events: BuildEvent[] = [{ time: 5, kind: "build_structure", unitId: "barracks" }];
    const s = scheduleProduction(events, LOTV_PATCH)[0];
    expect(s).toMatchObject({ isBuilding: true, start: 5, end: 51 }); // barracks buildTime 46
  });

  it("생산 건물이 없으면 마커 시각에 시작(폴백)", () => {
    const events: BuildEvent[] = [{ time: 10, kind: "train_unit", unitId: "marine" }];
    const s = scheduleProduction(events, LOTV_PATCH)[0];
    expect(s).toMatchObject({ start: 10, end: 28, facility: "" });
  });

  it("병영 완성 후에야 마린 생산 시작", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 완성 46
      { time: 10, kind: "train_unit", unitId: "marine" }, // 주문 10, 하지만 46부터
    ];
    const marine = byId(scheduleProduction(events, LOTV_PATCH), "marine")[0];
    expect(marine.orderTime).toBe(10);
    expect(marine.start).toBe(46);
    expect(marine.end).toBe(64);
    expect(marine.facility).toBe("barracks");
  });

  it("병영 1개 + 마린 2기 → 순차 큐(둘째는 첫째 완료 후)", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" },
      { time: 50, kind: "train_unit", unitId: "marine" },
      { time: 50, kind: "train_unit", unitId: "marine" },
    ];
    const marines = byId(scheduleProduction(events, LOTV_PATCH), "marine");
    expect(marines[0]).toMatchObject({ start: 50, end: 68 });
    expect(marines[1]).toMatchObject({ start: 68, end: 86 }); // 자리 없어 다음 완료로 밀림
    // 같은 병영 인스턴스 체인
    expect(marines[0].machineId).toBe(marines[1].machineId);
  });

  it("병영 2개 + 마린 2기 → 병렬(둘 다 즉시)", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" },
      { time: 0, kind: "build_structure", unitId: "barracks" },
      { time: 50, kind: "train_unit", unitId: "marine" },
      { time: 50, kind: "train_unit", unitId: "marine" },
    ];
    const marines = byId(scheduleProduction(events, LOTV_PATCH), "marine");
    expect(marines[0].start).toBe(50);
    expect(marines[1].start).toBe(50); // 다른 병영에 배정
    expect(marines[0].machineId).not.toBe(marines[1].machineId);
  });

  it("차원관문: 워프게이트 연구(100s) 후 관문 유닛 워프인(5s), 연구 전엔 일반", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "gateway" }, // 온라인 46
      { time: 0, kind: "build_structure", unitId: "warpgate" }, // 연구 완료 100
      { time: 50, kind: "train_unit", unitId: "zealot" }, // 연구 전
      { time: 110, kind: "train_unit", unitId: "zealot" }, // 연구 후
    ];
    const z = scheduleProduction(events, LOTV_PATCH, "protoss").filter((s) => s.unitId === "zealot");
    expect(z[0].end).toBe(77); // 50+27 일반 생산
    expect(z[1].start).toBe(110);
    expect(z[1].end).toBe(115); // 워프인 5s
  });

  it("반응로 애드온: 지정 병영에 2슬롯 → 동시 2기(같은 건물)", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // barracks#0, 온라인 46
      { time: 0, kind: "addon", machineId: "barracks#0", addon: "reactor" },
      { time: 50, kind: "train_unit", unitId: "marine" },
      { time: 50, kind: "train_unit", unitId: "marine" },
      { time: 50, kind: "train_unit", unitId: "marine" },
    ];
    const m = scheduleProduction(events, LOTV_PATCH).filter((s) => s.unitId === "marine");
    expect(m[0].start).toBe(50);
    expect(m[1].start).toBe(50); // 2번째 슬롯 → 병렬
    expect(m[0].machineId).toBe("barracks#0"); // 같은 건물(같은 열)
    expect(m[1].machineId).toBe("barracks#0");
    expect(m[2].start).toBe(68); // 3번째는 슬롯 없어 대기
  });

  it("시작 보유 사령부에서 SCV 순차 생산", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "train_unit", unitId: "scv" },
      { time: 0, kind: "train_unit", unitId: "scv" },
    ];
    const scvs = byId(scheduleProduction(events, LOTV_PATCH), "scv");
    expect(scvs[0]).toMatchObject({ start: 0, end: 12 });
    expect(scvs[1]).toMatchObject({ start: 12, end: 24 }); // 사령부 1개라 대기
  });
});
