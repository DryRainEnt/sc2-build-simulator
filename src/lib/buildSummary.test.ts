import { describe, it, expect } from "vitest";
import { summarizeBuild, productionLayout } from "./buildSummary";
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
    expect(labels).toContain("가스 배치 3");
    expect(labels).toContain("채취정지 2기/10s");
  });
});

describe("productionLayout — 기간 막대 배치", () => {
  it("시작→완료 범위를 buildTime으로 계산하고 동일 항목은 개수로 묶는다", () => {
    const events: BuildEvent[] = [
      { time: 10, kind: "train_unit", unitId: "marine" },
      { time: 10, kind: "train_unit", unitId: "marine" },
      { time: 10, kind: "train_unit", unitId: "marine" },
    ];
    const bars = productionLayout(events, LOTV_PATCH);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ time: 10, end: 28, count: 3, unitId: "marine", lane: 0 });
  });

  it("시간이 겹치는 서로 다른 생산은 다른 레인에 배치", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "barracks" }, // 0~46
      { time: 10, kind: "train_unit", unitId: "marine" }, // 10~28 (겹침)
    ];
    const bars = productionLayout(events, LOTV_PATCH);
    const barracks = bars.find((b) => b.unitId === "barracks")!;
    const marine = bars.find((b) => b.unitId === "marine")!;
    expect(barracks.lane).toBe(0);
    expect(marine.lane).toBe(1);
  });

  it("시간이 안 겹치면 같은 레인 재사용", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "train_unit", unitId: "marine" }, // 0~18
      { time: 50, kind: "train_unit", unitId: "marine" }, // 50~68
    ];
    const bars = productionLayout(events, LOTV_PATCH);
    expect(bars.every((b) => b.lane === 0)).toBe(true);
  });

  it("행동 이벤트는 막대에서 제외", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "assign_worker", workers: 3, to: "gas" },
      { time: 5, kind: "train_unit", unitId: "marine" },
    ];
    const bars = productionLayout(events, LOTV_PATCH);
    expect(bars).toHaveLength(1);
    expect(bars[0].unitId).toBe("marine");
  });
});
