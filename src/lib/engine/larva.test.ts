import { describe, it, expect } from "vitest";
import { computeLarva } from "./larva";
import { scheduleProduction } from "./schedule";
import { DEFAULT_PATCH } from "../data/registry"; // 5.0.16: 애벌레 9.9초
import type { BuildEvent } from "./types";

const drones = (n: number, time = 0): BuildEvent[] =>
  Array.from({ length: n }, () => ({ time, kind: "train_unit", unitId: "drone" }));

describe("computeLarva — 저그 애벌레 풀", () => {
  it("시작 애벌레 3, 기지당 3까지만 참", () => {
    const lr = computeLarva([], DEFAULT_PATCH, "zerg");
    expect(lr.larvaAt(0)).toBe(3);
    expect(lr.larvaAt(100)).toBe(3); // 상한
  });

  it("비저그는 애벌레 없음", () => {
    expect(computeLarva([], DEFAULT_PATCH, "terran").larvaAt(50)).toBe(0);
  });

  it("애벌레 소비 후 9.9초마다 재생", () => {
    const lr = computeLarva(drones(3), DEFAULT_PATCH, "zerg"); // 3개 소비 → 0
    expect(lr.larvaAt(0)).toBe(0);
    expect(lr.larvaAt(9.9)).toBe(1); // 한 번 재생
    expect(lr.larvaAt(19.8)).toBe(2);
  });
});

describe("scheduleProduction — 애벌레 게이팅", () => {
  it("시작 3애벌레: 드론 3기 즉시, 4번째는 재생 대기(9.9s)", () => {
    const sched = scheduleProduction(drones(4), DEFAULT_PATCH, "zerg");
    const d = sched.filter((s) => s.unitId === "drone");
    expect(d[0].start).toBe(0);
    expect(d[1].start).toBe(0);
    expect(d[2].start).toBe(0);
    expect(d[3].start).toBeCloseTo(9.9, 5); // 애벌레 없어 다음 재생까지
    expect(d[3].facility).toBe("larva");
  });

  it("저글링 0.5 애벌레: 3라바로 6마리 즉시, 7번째는 0.5재생 대기", () => {
    const events: BuildEvent[] = Array.from({ length: 7 }, () => ({
      time: 0,
      kind: "train_unit",
      unitId: "zergling",
    }));
    const z = scheduleProduction(events, DEFAULT_PATCH, "zerg").filter((s) => s.unitId === "zergling");
    for (let i = 0; i < 6; i++) expect(z[i].start).toBe(0);
    expect(z[6].start).toBeCloseTo(0.5 * 9.9, 5); // 0.5 애벌레 재생 = 4.95초
  });
});
