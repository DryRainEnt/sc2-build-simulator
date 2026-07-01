import { describe, it, expect } from "vitest";
import { buildRegistry, resolvePatch, toPatchData, findDanglingRefs } from "./registry";
import type { PatchFile } from "./schema";
import { REGISTRY, DEFAULT_PATCH, RAW_PATCHES } from "./registry";

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

  it("실데이터에 오타로 인한 잘못된 참조(dangling ref)가 없다", () => {
    const map = new Map(RAW_PATCHES.map((f) => [f.version, f]));
    for (const raw of RAW_PATCHES) {
      const full = resolvePatch(raw.version, map);
      const dangling = findDanglingRefs(full);
      expect(dangling, `${raw.version}: ${JSON.stringify(dangling)}`).toEqual([]);
    }
  });

  it("테란 데이터가 완비되어 있다(핵심 유닛/건물 존재 + 확정 수치)", () => {
    const u = DEFAULT_PATCH.units;
    // 대표 확정치 몇 개 스팟체크 (Liquipedia LotV)
    expect(u.battlecruiser).toMatchObject({ minerals: 400, gas: 300, supply: 6, buildTime: 64 });
    expect(u.marauder).toMatchObject({ minerals: 100, gas: 25, buildTime: 21 });
    expect(u.starport).toMatchObject({ minerals: 150, gas: 100, buildTime: 36 });
    // 테크트리: 전투순양함은 스타포트+테크랩+핵융합로 선행
    expect(u.battlecruiser.requires).toEqual(["starport", "tech_lab", "fusion_core"]);
    const terran = Object.values(u).filter((x) => x.race === "terran");
    expect(terran.length).toBeGreaterThanOrEqual(30);
  });

  it("3종족 데이터가 모두 완비되어 있다(개수 + 스팟체크)", () => {
    const u = Object.values(DEFAULT_PATCH.units);
    const count = (r: string) => u.filter((x) => x.race === r).length;
    expect(count("terran")).toBeGreaterThanOrEqual(30);
    expect(count("protoss")).toBeGreaterThanOrEqual(30);
    expect(count("zerg")).toBeGreaterThanOrEqual(30);

    const m = DEFAULT_PATCH.units;
    // 프로토스 스팟 (Liquipedia LotV)
    expect(m.carrier).toMatchObject({ minerals: 350, gas: 250, supply: 6, buildTime: 64 });
    expect(m.stalker.requires).toEqual(["cybernetics_core"]);
    expect(m.nexus.supplyProvided).toBe(15);
    // 저그 스팟 + 변태 관계
    expect(m.ultralisk).toMatchObject({ minerals: 275, gas: 200, supply: 6 });
    expect(m.baneling.morphedFrom).toBe("zergling");
    expect(m.lair.morphedFrom).toBe("hatchery");
    expect(m.overlord.supplyProvided).toBe(8);
    // 각 종족 본진은 시작 보유
    expect(m.nexus.startCount).toBe(1);
    expect(m.hatchery.startCount).toBe(1);
  });

  it("모든 종족의 일꾼과 본진 관계가 일관된다", () => {
    const m = DEFAULT_PATCH.units;
    expect(m.probe.isWorker).toBe(true);
    expect(m.drone.isWorker).toBe(true);
    expect(m.scv.isWorker).toBe(true);
    // 저그 유닛은 대부분 라바 변태
    expect(m.roach.morphedFrom).toBe("larva");
    expect(m.mutalisk.producedFrom).toContain("larva");
  });
});
