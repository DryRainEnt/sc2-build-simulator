import { describe, it, expect } from "vitest";
import { buildRegistry, resolvePatch, toPatchData } from "./registry";
import type { PatchFile } from "./schema";
import { REGISTRY, DEFAULT_PATCH } from "./registry";

const BASE: PatchFile = {
  version: "1.0.0",
  name: "Base",
  harvest: {
    mineralPerWorker: 0.6667,
    mineralPerWorkerSaturated: 0.3333,
    gasPerWorker: 0.6333,
    workersPerMineralPatch: 2,
    maxWorkersPerMineralPatch: 3,
    maxWorkersPerGeyser: 3,
  },
  start: { minerals: 50, gas: 0, workers: 12, supplyCap: 15 },
  base: { mineralPatches: 8, geysers: 2 },
  units: {
    scv: { name: "SCV", race: "terran", category: "worker", minerals: 50, gas: 0, supply: 1, buildTime: 12 },
    marine: { name: "Marine", race: "terran", category: "unit", minerals: 50, gas: 0, supply: 1, buildTime: 18 },
  },
};

describe("패치 레지스트리 — 상속 오버라이드", () => {
  it("extends 로 바뀐 값만 diff 하고 나머지는 베이스 상속", () => {
    const override: PatchFile = {
      version: "1.0.1",
      extends: "1.0.0",
      name: "Balance 1.0.1",
      units: { marine: { minerals: 45 } }, // 마린 비용만 너프
    };
    const map = new Map<string, PatchFile>([
      ["1.0.0", BASE],
      ["1.0.1", override],
    ]);

    const resolved = resolvePatch("1.0.1", map);
    expect(resolved.units.marine.minerals).toBe(45); // 오버라이드 반영
    expect(resolved.units.marine.buildTime).toBe(18); // 나머지 필드 상속
    expect(resolved.units.scv.minerals).toBe(50); // 손대지 않은 유닛 유지
    expect(resolved.start.workers).toBe(12); // 경제도 상속
    expect(resolved.name).toBe("Balance 1.0.1");
  });

  it("체인 상속(2단계)과 harvest 부분 오버라이드", () => {
    const v2: PatchFile = { version: "1.0.1", extends: "1.0.0", harvest: { gasPerWorker: 0.7 } };
    const v3: PatchFile = { version: "1.0.2", extends: "1.0.1", start: { supplyCap: 14 } };
    const map = new Map<string, PatchFile>([
      ["1.0.0", BASE],
      ["1.0.1", v2],
      ["1.0.2", v3],
    ]);
    const r = resolvePatch("1.0.2", map);
    expect(r.harvest.gasPerWorker).toBe(0.7); // v2에서
    expect(r.harvest.mineralPerWorker).toBeCloseTo(0.6667, 6); // 베이스 유지
    expect(r.start.supplyCap).toBe(14); // v3에서
    expect(r.start.workers).toBe(12); // 베이스 유지
  });

  it("새 유닛을 부분정의로만 추가하면 검증 실패(완전 정의 강제)", () => {
    const bad: PatchFile = {
      version: "1.0.1",
      extends: "1.0.0",
      units: { reaper: { minerals: 50 } }, // name/race/category/... 누락
    };
    const map = new Map<string, PatchFile>([
      ["1.0.0", BASE],
      ["1.0.1", bad],
    ]);
    expect(() => resolvePatch("1.0.1", map)).toThrow();
  });

  it("순환 상속 감지", () => {
    const a: PatchFile = { version: "a", extends: "b", name: "A" } as PatchFile;
    const b: PatchFile = { version: "b", extends: "a", name: "B" } as PatchFile;
    const map = new Map<string, PatchFile>([["a", a], ["b", b]]);
    expect(() => resolvePatch("a", map)).toThrow(/순환/);
  });

  it("toPatchData: category=worker 는 isWorker 로 파생", () => {
    const pd = toPatchData(resolvePatch("1.0.0", new Map([["1.0.0", BASE]])));
    expect(pd.units.scv.isWorker).toBe(true);
    expect(pd.units.marine.isWorker).toBe(false);
  });

  it("buildRegistry: 버전 정렬(numeric)", () => {
    const list = buildRegistry([
      { ...BASE, version: "1.0.10" },
      { ...BASE, version: "1.0.9" },
      { ...BASE, version: "1.0.2" },
    ]);
    expect(list.map((p) => p.id)).toEqual(["1.0.2", "1.0.9", "1.0.10"]);
  });
});

describe("패치 레지스트리 — 실데이터 로드", () => {
  it("patches/*.json 이 검증 통과해 로드된다", () => {
    expect(REGISTRY.length).toBeGreaterThan(0);
    expect(DEFAULT_PATCH.units.scv.isWorker).toBe(true);
    expect(DEFAULT_PATCH.start.workers).toBe(12);
  });
});
