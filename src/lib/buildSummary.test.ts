import { describe, it, expect } from "vitest";
import { summarizeBuild, timelineBars } from "./buildSummary";
import { LOTV_PATCH } from "./data/lotv";
import type { BuildEvent } from "./engine/types";

describe("summarizeBuild — 빌드 칩 요약", () => {
  it("같은 시각의 동일 항목을 묶고 개수를 센다", () => {
    const events: BuildEvent[] = [
      { time: 10, kind: "train_unit", unitId: "marine" },
      { time: 10, kind: "train_unit", unitId: "marine" },
      { time: 10, kind: "train_unit", unitId: "marine" },
    ];
    const g = summarizeBuild(events, LOTV_PATCH);
    expect(g).toHaveLength(1);
    expect(g[0].time).toBe(10);
    expect(g[0].items).toHaveLength(1);
    expect(g[0].items[0]).toMatchObject({ label: "Marine", count: 3, unitId: "marine" });
  });

  it("서로 다른 항목/시각은 분리하고 시간순 정렬", () => {
    const events: BuildEvent[] = [
      { time: 30, kind: "build_structure", unitId: "barracks" },
      { time: 5, kind: "train_worker" },
      { time: 5, kind: "train_unit", unitId: "marine" },
    ];
    const g = summarizeBuild(events, LOTV_PATCH);
    expect(g.map((x) => x.time)).toEqual([5, 30]);
    expect(g[0].items.map((i) => i.label).sort()).toEqual(["Marine", "일꾼"]);
    expect(g[1].items[0].label).toBe("Barracks");
  });

  it("행동 이벤트도 사람이 읽을 라벨로 요약", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "assign_worker", workers: 3, to: "gas" },
      { time: 0, kind: "worker_transfer", workers: 2, duration: 10 },
    ];
    const g = summarizeBuild(events, LOTV_PATCH);
    const labels = g[0].items.map((i) => i.label);
    expect(labels).toContain("가스 일꾼 3");
    expect(labels).toContain("채취정지 2기/10s");
  });
});

describe("timelineBars — 생산(스케줄) + 채취정지 통합 배치", () => {
  it("각 생산은 하나의 막대(스케줄된 실제 시작~완료), 개수 묶음 없음", () => {
    const events: BuildEvent[] = [
      { time: 10, kind: "train_unit", unitId: "marine" },
      { time: 10, kind: "train_unit", unitId: "marine" },
    ];
    // 병영 없음 → 폴백으로 둘 다 주문시각 시작(같은 슬롯 아님)
    const bars = timelineBars(events, LOTV_PATCH);
    expect(bars.filter((b) => b.kind === "prod")).toHaveLength(2);
    expect(bars[0]).toMatchObject({ kind: "prod", start: 10, end: 28, orderTime: 10, unitId: "marine" });
  });

  it("건물 바쁘면 막대가 밀리고 orderTime<start (큐 대기)", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 완성 46
      { time: 10, kind: "train_unit", unitId: "marine" }, // 주문 10 → 시작 46
    ];
    const marine = timelineBars(events, LOTV_PATCH).find((b) => b.unitId === "marine")!;
    expect(marine.orderTime).toBe(10);
    expect(marine.start).toBe(46);
    expect(marine.end).toBe(64);
  });

  it("정지 이벤트를 [시작,시작+지속] 막대로, 원본 인덱스 보존", () => {
    const events: BuildEvent[] = [{ time: 5, kind: "worker_transfer", workers: 1, duration: 8 }];
    const bars = timelineBars(events, LOTV_PATCH);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ kind: "pause", start: 5, end: 13, eventIndex: 0, workers: 1 });
  });

  it("건물 인스턴스마다 고정 트랙: 같은 병영의 건설바+유닛이 같은 열, 다른 병영은 다른 열", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // barracks#0
      { time: 0, kind: "build_structure", unitId: "barracks" }, // barracks#1
      { time: 50, kind: "train_unit", unitId: "marine" }, // → 병영#0
      { time: 50, kind: "train_unit", unitId: "marine" }, // → 병영#1
    ];
    const bars = timelineBars(events, LOTV_PATCH).filter((b) => b.kind === "prod");
    const barracks = bars.filter((b) => b.unitId === "barracks");
    const marines = bars.filter((b) => b.unitId === "marine");
    // 병영 2개 = 2개 트랙(레인)
    expect(new Set(barracks.map((b) => b.lane)).size).toBe(2);
    // 두 마린은 서로 다른 병영 열에 배정
    expect(marines[0].lane).not.toBe(marines[1].lane);
    // 각 마린 열 == 어떤 병영 열
    const barracksLanes = new Set(barracks.map((b) => b.lane));
    expect(barracksLanes.has(marines[0].lane)).toBe(true);
    expect(barracksLanes.has(marines[1].lane)).toBe(true);
  });

  it("생산과 정지가 시간상 겹치면 서로 다른 레인", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 0~46
      { time: 10, kind: "worker_transfer", workers: 1, duration: 20 }, // 10~30 (겹침)
    ];
    const bars = timelineBars(events, LOTV_PATCH);
    const prod = bars.find((b) => b.kind === "prod")!;
    const pause = bars.find((b) => b.kind === "pause")!;
    expect(prod.lane).not.toBe(pause.lane);
    expect(pause.eventIndex).toBe(1);
  });
});
