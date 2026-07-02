<script lang="ts">
  import { timeToPx } from "../config";
  import type { LarvaResult } from "../engine/larva";

  export let larva: LarvaResult;
  export let duration: number;
  export let side: "left" | "right";

  const SCALE = 7; // 애벌레 1개당 px 폭
  const OFFSET = 16; // 중앙축에서의 안쪽 오프셋

  $: h = timeToPx(duration);

  // 표본 시각: 1초 간격 + 소비 지점(급강하)을 앞뒤로 포함
  $: sampleTimes = (() => {
    const set = new Set<number>();
    for (let t = 0; t <= duration; t += 1) set.add(t);
    for (const bp of larva.breakpoints) {
      if (bp.t <= duration) {
        set.add(bp.t);
        if (bp.t - 0.001 >= 0) set.add(bp.t - 0.001);
      }
    }
    return [...set].sort((a, b) => a - b);
  })();

  $: samples = sampleTimes.map((t) => ({ y: timeToPx(t), v: larva.larvaAt(t) }));
  $: maxV = Math.max(3, ...samples.map((s) => s.v));
  $: width = maxV * SCALE;

  // 영역 폴리곤: side='left'는 안쪽(오른쪽 가장자리)에서 왼쪽으로, 'right'는 반대
  $: path = (() => {
    if (!samples.length) return "";
    const x = (v: number) => (side === "left" ? width - v * SCALE : v * SCALE);
    const inner = side === "left" ? width : 0;
    const pts = samples.map((s) => `L ${x(s.v).toFixed(1)},${s.y.toFixed(1)}`).join(" ");
    const first = samples[0];
    const last = samples[samples.length - 1];
    return `M ${inner},${first.y.toFixed(1)} ${pts} L ${inner},${last.y.toFixed(1)} Z`;
  })();

  // 눈금선 (애벌레 1,2,3…)
  $: gridX = Array.from({ length: Math.floor(maxV) }, (_, i) => i + 1).map((v) =>
    side === "left" ? width - v * SCALE : v * SCALE,
  );
</script>

<svg
  class="larva-graph {side}"
  style={side === "left" ? `right: calc(50% + ${OFFSET}px)` : `left: calc(50% + ${OFFSET}px)`}
  width={width}
  height={h}
  viewBox="0 0 {width} {h}"
>
  {#each gridX as gx}
    <line x1={gx} y1="0" x2={gx} y2={h} class="grid" />
  {/each}
  <path d={path} class="area" />
</svg>

<style>
  .larva-graph {
    position: absolute;
    top: 0;
    z-index: 1;
    pointer-events: none;
    overflow: visible;
  }
  .area {
    fill: #a78bfa;
    fill-opacity: 0.45;
    stroke: #7c3aed;
    stroke-width: 1;
    stroke-opacity: 0.7;
  }
  .grid {
    stroke: #7c3aed;
    stroke-width: 0.5;
    stroke-opacity: 0.18;
  }
</style>
