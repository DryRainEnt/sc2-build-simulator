import { describe, it, expect } from "vitest";
import { summarizeBuild, timelineBars, facilityTracks, contiguousBlock, idleIntervals } from "./buildSummary";
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

  it("facilityTracks: 반응로 건물은 2줄, 일반은 1줄", () => {
    const withR: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" },
      { time: 0, kind: "addon", machineId: "barracks#0", addon: "reactor" },
      { time: 50, kind: "train_unit", unitId: "marine" },
    ];
    const tr = facilityTracks(withR, LOTV_PATCH).find((t) => t.machineId === "barracks#0")!;
    expect(tr.hasReactor).toBe(true);
    expect(tr.laneCount).toBe(2);

    const noR: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" },
      { time: 50, kind: "train_unit", unitId: "marine" },
    ];
    const tn = facilityTracks(noR, LOTV_PATCH).find((t) => t.machineId === "barracks#0")!;
    expect(tn.hasReactor).toBe(false);
    expect(tn.laneCount).toBe(1);
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

describe("contiguousBlock — 드래그 이동 블록", () => {
  it("같은 병영에서 back-to-back 연속 큐만 함께 이동", () => {
    // 병영(0~46) 완성 전 마린 3기 큐잉 → 46~64, 64~82, 82~100 (병영과 연속)
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // idx0
      { time: 10, kind: "train_unit", unitId: "marine" }, // idx1
      { time: 10, kind: "train_unit", unitId: "marine" }, // idx2
      { time: 10, kind: "train_unit", unitId: "marine" }, // idx3
    ];
    const bars = timelineBars(events, LOTV_PATCH);
    const firstMarine = bars.find((b) => b.unitId === "marine")!;
    // 첫 마린을 잡으면 뒤의 두 마린도 함께 (연속)
    expect(contiguousBlock(bars, firstMarine).sort()).toEqual([1, 2, 3]);
    // 병영 건설바를 잡으면 건설 + 그 뒤 마린 전부
    const barracksBar = bars.find((b) => b.unitId === "barracks")!;
    expect(contiguousBlock(bars, barracksBar).sort()).toEqual([0, 1, 2, 3]);
  });

  it("생산 사이 유휴 구간 검출", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 온라인 46
      { time: 10, kind: "train_unit", unitId: "marine" }, // 46~64
      { time: 100, kind: "train_unit", unitId: "marine" }, // 100~118
    ];
    const idle = idleIntervals(timelineBars(events, LOTV_PATCH));
    expect(idle).toHaveLength(1);
    expect(idle[0]).toMatchObject({ start: 64, end: 100 }); // 병영 놀던 구간
  });

  it("온라인 후 첫 생산까지도 유휴", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 온라인 46
      { time: 100, kind: "train_unit", unitId: "marine" }, // 100~
    ];
    const idle = idleIntervals(timelineBars(events, LOTV_PATCH));
    expect(idle).toHaveLength(1);
    expect(idle[0]).toMatchObject({ start: 46, end: 100 });
  });

  it("틈(idle)이 있으면 거기서 블록이 끊긴다", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 완성 46
      { time: 50, kind: "train_unit", unitId: "marine" }, // 50~68
      { time: 200, kind: "train_unit", unitId: "marine" }, // 200~ (틈 큼)
    ];
    const bars = timelineBars(events, LOTV_PATCH, "terran");
    const firstMarine = bars.filter((b) => b.unitId === "marine").sort((a, b) => a.start - b.start)[0];
    // 두 마린 사이 유휴 → 첫 마린만
    expect(contiguousBlock(bars, firstMarine)).toEqual([firstMarine.eventIndex]);
  });
});
