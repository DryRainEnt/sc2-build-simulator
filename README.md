# SC2 Build Simulator · 스타2 빌드 시뮬레이터

A StarCraft II build-order economy simulator. Place production on a vertical
timeline and read exact minerals / gas / supply at any moment — all three races,
patch-versioned data.

세로 시간선에 생산을 배치하면 임의 시점의 미네랄·가스·인구를 정확히 계산해 주는
스타크래프트2 빌드오더 시뮬레이터. 3종족 지원, 패치 버전별 데이터.

**Live:** https://dryrainent.github.io/sc2-build-simulator/

## Features

- 3-race unit / building / upgrade data (Liquipedia LotV), patch-versioned via `extends` + zod
- Exact economy: per-worker mineral/gas harvest with saturation + trip quantization (game-time)
- Production scheduling: building slots, reactor 2-slot, warp-in, Zerg larva pool, queen inject
- Supply consumed at order time; Zerg drones consumed when morphing into buildings
- Tech-prerequisite warnings, resource-shortage markers, idle-building highlight
- Build share codes, custom patch editor, dark mode, UI scale, Korean / English

## Develop

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # vitest
npm run check    # svelte-check
npm run build    # dist/
```

Stack: Svelte + TypeScript + Vite + Vitest.

## Data architecture

Each balance patch is one file under `src/lib/data/patches/`. A new patch
`extends` a previous one and lists only changed values (diff); the registry
deep-merges and validates via zod into the engine's `PatchData`. Harvest rates,
costs, supply, build times, larva, warp — all editable at runtime in the custom
patch editor.

## License

Source code: [MIT](LICENSE).

Unofficial, non-commercial fan project — **not affiliated with, endorsed by, or
sponsored by Blizzard Entertainment**. StarCraft is a trademark of Blizzard
Entertainment. Game data/icons belong to Blizzard; icons are bundled from
community sources (see `src/assets/icons/ATTRIBUTION.md`).
