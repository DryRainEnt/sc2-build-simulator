import { describe, it, expect } from "vitest";
import { gasIncomePerSec, mineralIncomePerSec } from "./harvest";
import { simulate } from "./simulate";
import { LOTV_PATCH } from "../data/lotv";
import type { BuildEvent } from "./types";

const M = LOTV_PATCH.harvest;

describe("채취율 모델 (harvest)", () => {
  it("정상 슬롯 이내에서는 일꾼당 고효율로 선형 증가", () => {
    // 8패치 → 정상 슬롯 16. 12일꾼 전원 고효율.
    expect(mineralIncomePerSec(12, 8, M)).toBeCloseTo(12 * (40 / 60), 6);
    expect(mineralIncomePerSec(16, 8, M)).toBeCloseTo(16 * (40 / 60), 6);
  });

  it("3번째/패치 일꾼은 포화 저효율", () => {
    // 24일꾼 = 8패치 * 3. 정상16 + 포화8.
    const expected = 16 * (40 / 60) + 8 * (20 / 60);
    expect(mineralIncomePerSec(24, 8, M)).toBeCloseTo(expected, 6);
  });

  it("최대 포화 초과 일꾼은 유휴(수입 증가 없음)", () => {
    const full = mineralIncomePerSec(24, 8, M);
    expect(mineralIncomePerSec(30, 8, M)).toBeCloseTo(full, 6);
  });

  it("가스는 간헐천당 최대 3기까지 선형, 초과는 유휴", () => {
    expect(gasIncomePerSec(6, 2, M)).toBeCloseTo(6 * (38 / 60), 6);
    expect(gasIncomePerSec(10, 2, M)).toBeCloseTo(6 * (38 / 60), 6);
  });
});

describe("시뮬레이션 — 기본 경제", () => {
  it("이벤트가 없으면 12일꾼이 8/초로 미네랄을 모은다", () => {
    const r = simulate([], LOTV_PATCH, { duration: 120 });
    const s0 = r.stateAt(0);
    expect(s0.minerals).toBe(50);
    expect(s0.workers).toBe(12);
    expect(s0.supplyUsed).toBe(12);
    expect(s0.supplyCap).toBe(15);

    // 12 * 40/60 = 8/초 → 60초 후 50 + 480 = 530
    expect(r.stateAt(60).minerals).toBeCloseTo(530, 6);
    expect(r.errors).toHaveLength(0);
  });

  it("일꾼 생산: 완성 시점에 채취 인구 합류 + 수입 증가", () => {
    const events: BuildEvent[] = [{ time: 0, kind: "train_worker" }];
    const r = simulate(events, LOTV_PATCH, { duration: 60 });

    // t=0 에 50 소모 → 0, 아직 12일꾼
    expect(r.stateAt(0).minerals).toBeCloseTo(0, 6);
    expect(r.stateAt(5).workers).toBe(12);
    // buildTime 12초 후 13일꾼
    expect(r.stateAt(12).workers).toBe(13);
    expect(r.stateAt(12).supplyUsed).toBe(13);

    // 0~12초: 12일꾼(8/s) → 96. 12~60초(48초): 13일꾼(13*40/60=8.667/s) → 416
    const expected = 0 + 8 * 12 + 13 * (40 / 60) * 48;
    expect(r.stateAt(60).minerals).toBeCloseTo(expected, 6);
  });
});

describe("시뮬레이션 — 자원 부족 오류 마커", () => {
  it("보유 자원 이상으로 소모하면 마이너스 지점에 오류 기록", () => {
    // 시작 미네랄 50인데 t=0에 일꾼 2기(=100) 주문 → -50
    const events: BuildEvent[] = [
      { time: 0, kind: "train_worker" },
      { time: 0, kind: "train_worker" },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 30 });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toMatchObject({ time: 0, resource: "minerals" });
    expect(r.errors[0].deficit).toBeCloseTo(50, 6);
    expect(r.stateAt(0).minerals).toBeCloseTo(-50, 6);
  });

  it("가스가 없는 상태에서 가스 소모 시 가스 오류", () => {
    // marine은 가스 0이므로 가스 드는 유닛 필요 → 임의 가스 유닛 주문 대신
    // 직접 가스 소모를 만들기 위해 zealot(가스 0)이 아닌 케이스가 없으므로
    // assign 없이 가스 소모가 있는 커스텀 이벤트로 검증.
    const patch = structuredClone(LOTV_PATCH);
    patch.units["ghost"] = {
      id: "ghost",
      name: "Ghost",
      race: "terran",
      category: "unit",
      minerals: 150,
      gas: 125,
      supply: 2,
      buildTime: 29,
    };
    const events: BuildEvent[] = [{ time: 0, kind: "train_unit", unitId: "ghost" }];
    const r = simulate(events, patch, { duration: 30 });
    const gasErr = r.errors.find((e) => e.resource === "gas");
    expect(gasErr).toBeDefined();
    expect(gasErr!.deficit).toBeCloseTo(125, 6);
  });
});

describe("시뮬레이션 — 일꾼 이동/재배치/사망", () => {
  it("worker_transfer는 해당 구간 동안 채취를 멈춘다", () => {
    // 12일꾼 전원 10~20초 구간 채취 정지
    const events: BuildEvent[] = [
      { time: 10, kind: "worker_transfer", workers: 12, duration: 10 },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 60 });

    // 0~10s: 8/s → 80. 10~20s: 0/s. 20~60s(40s): 8/s → 320. +시작50
    const expected = 50 + 8 * 10 + 0 + 8 * 40;
    expect(r.stateAt(60).minerals).toBeCloseTo(expected, 6);
    // 정지 중(15s)에는 10초 시점과 미네랄이 동일
    expect(r.stateAt(15).minerals).toBeCloseTo(r.stateAt(10).minerals, 6);
  });

  it("assign_worker로 일꾼을 가스로 옮기면 가스 수입 발생", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "assign_worker", workers: 3, to: "gas" },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 60 });
    const s = r.stateAt(60);
    expect(s.gasWorkers).toBe(3);
    expect(s.mineralWorkers).toBe(9);
    expect(s.gas).toBeCloseTo(3 * (38 / 60) * 60, 6); // 114
  });

  it("일꾼 사망 시 채취 인구와 보급이 감소", () => {
    const events: BuildEvent[] = [
      { time: 30, kind: "unit_death", unitId: "worker", count: 2 },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 60 });
    expect(r.stateAt(31).workers).toBe(10);
    expect(r.stateAt(31).supplyUsed).toBe(10);
  });
});

describe("시뮬레이션 — 테크 선행조건 게이팅", () => {
  it("선행 건물 없이 유닛 배치하면 경고(차단 아님)", () => {
    // 병영 없이 t=0에 마린 → barracks 미충족 경고
    const r = simulate([{ time: 0, kind: "train_unit", unitId: "marine" }], LOTV_PATCH, {
      duration: 60,
    });
    expect(r.techWarnings).toHaveLength(1);
    expect(r.techWarnings[0]).toMatchObject({ time: 0, unitId: "marine" });
    expect(r.techWarnings[0].missing).toContain("barracks");
  });

  it("선행 건물이 완성된 뒤 배치하면 경고 없음", () => {
    // 보급고(0,완성21) → 병영(21,완성67) → 마린(70): 모두 충족
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "supply_depot" },
      { time: 21, kind: "build_structure", unitId: "barracks" },
      { time: 70, kind: "train_unit", unitId: "marine" },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 120 });
    expect(r.techWarnings).toHaveLength(0);
  });

  it("선행 건물이 아직 건설 중이면 경고", () => {
    // 병영 t=0(완성46), 마린 t=40 → 아직 미완성 → 경고
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "supply_depot" },
      { time: 0, kind: "build_structure", unitId: "barracks" },
      { time: 40, kind: "train_unit", unitId: "marine" },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 120 });
    const marineWarn = r.techWarnings.find((w) => w.unitId === "marine");
    expect(marineWarn).toBeDefined();
    expect(marineWarn!.missing).toContain("barracks");
  });

  it("시작 보유 본진은 선행조건을 충족시킨다", () => {
    // engineering_bay requires command_center(시작 보유) → t=0 배치도 경고 없음
    const r = simulate([{ time: 0, kind: "build_structure", unitId: "engineering_bay" }], LOTV_PATCH, {
      duration: 60,
    });
    expect(r.techWarnings.find((w) => w.unitId === "engineering_bay")).toBeUndefined();
  });

  it("다중 선행조건: 전투순양함은 스타포트+테크랩+핵융합로 필요", () => {
    const r = simulate([{ time: 0, kind: "train_unit", unitId: "battlecruiser" }], LOTV_PATCH, {
      duration: 60,
    });
    const w = r.techWarnings.find((x) => x.unitId === "battlecruiser");
    expect(w).toBeDefined();
    expect(w!.missing.sort()).toEqual(["fusion_core", "starport", "tech_lab"]);
  });
});

describe("시뮬레이션 — 보급 공급", () => {
  it("서플라이 디폿 완성 시 보급 최대치 증가", () => {
    const events: BuildEvent[] = [
      { time: 0, kind: "build_structure", unitId: "supply_depot" },
    ];
    const r = simulate(events, LOTV_PATCH, { duration: 60 });
    expect(r.stateAt(0).supplyCap).toBe(15);
    // buildTime 21초 후 +8
    expect(r.stateAt(21).supplyCap).toBe(23);
  });
});
