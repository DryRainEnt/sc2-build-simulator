<script lang="ts">
  import { timeToPx, pxToTime } from "../config";
  import {
    duration,
    markers,
    currentMarker,
    hoverTime,
    sims,
    patch,
    factions,
    placeMarker,
    selectMarker,
    removeMarker,
    removeOneEvent,
  } from "../stores/sim";
  import type { ResourceState } from "../engine/types";
  import { summarizeBuild } from "../buildSummary";
  import { unitIconUrl } from "../icons";
  import Icon from "./Icon.svelte";
  import ResourceReadout from "./ResourceReadout.svelte";

  const nameOf = (id: string) => $patch.units[id]?.name ?? id;
  const missingLabel = (missing: string[]) => missing.map(nameOf).join(", ");

  $: leftBuild = summarizeBuild($factions.left.events, $patch);
  $: rightBuild = summarizeBuild($factions.right.events, $patch);

  let el: HTMLDivElement;

  $: height = timeToPx($duration);

  // 10초마다 눈금.
  $: ticks = Array.from({ length: Math.floor($duration / 10) + 1 }, (_, i) => i * 10);

  function yToTime(clientY: number): number {
    const rect = el.getBoundingClientRect();
    const t = pxToTime(clientY - rect.top);
    return Math.max(0, Math.min($duration, t));
  }

  function onMove(e: PointerEvent) {
    hoverTime.set(Math.round(yToTime(e.clientY)));
  }
  function onLeave() {
    hoverTime.set(null);
  }
  function onClick(e: MouseEvent) {
    placeMarker(yToTime(e.clientY));
  }

  const neg = (s: ResourceState) => s.minerals < 0 || s.gas < 0;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="timearea">
  <div
    class="timeinner"
    bind:this={el}
    style="height: {height}px"
    on:pointermove={onMove}
    on:pointerleave={onLeave}
    on:click={onClick}
  >
  <!-- 중앙 시간선 -->
  <div class="axis"></div>
  {#each ticks as tk}
    <div class="tick" style="top: {timeToPx(tk)}px">
      <span class="tick-label">{tk}s</span>
    </div>
  {/each}

  <!-- 자원 부족 오류 마커 (진영별) -->
  {#each $sims.left.errors as err}
    <div class="errmark left" style="top: {timeToPx(err.time)}px" title="자원 부족: {err.resource} -{Math.ceil(err.deficit)}"></div>
  {/each}
  {#each $sims.right.errors as err}
    <div class="errmark right" style="top: {timeToPx(err.time)}px" title="자원 부족: {err.resource} -{Math.ceil(err.deficit)}"></div>
  {/each}

  <!-- 테크 선행조건 경고 마커 (진영별) -->
  {#each $sims.left.techWarnings as w}
    <div class="techmark left" style="top: {timeToPx(w.time)}px" title="{nameOf(w.unitId)}: 선행 부족 → {missingLabel(w.missing)}"></div>
  {/each}
  {#each $sims.right.techWarnings as w}
    <div class="techmark right" style="top: {timeToPx(w.time)}px" title="{nameOf(w.unitId)}: 선행 부족 → {missingLabel(w.missing)}"></div>
  {/each}

  <!-- 배치된 마커 -->
  {#each $markers as m}
    {@const ls = $sims.left.stateAt(m)}
    {@const rs = $sims.right.stateAt(m)}
    <div class="markerline" class:active={m === $currentMarker} style="top: {timeToPx(m)}px"></div>
    <button
      class="marker-dot"
      class:active={m === $currentMarker}
      style="top: {timeToPx(m)}px"
      title="마커 {m}s (클릭=선택, 더블클릭=삭제)"
      on:click|stopPropagation={() => selectMarker(m)}
      on:dblclick|stopPropagation={() => removeMarker(m)}
    ></button>
    <div class="readout left" class:err={neg(ls)} style="top: {timeToPx(m)}px"><ResourceReadout s={ls} /></div>
    <div class="readout right" class:err={neg(rs)} style="top: {timeToPx(m)}px"><ResourceReadout s={rs} /></div>
  {/each}

  <!-- 배치된 빌드 칩 (진영별) -->
  {#each leftBuild as g}
    <div class="build left" style="top: {timeToPx(g.time)}px">
      {#each g.items as it}
        <button
          class="chip"
          title="{it.label} @ {g.time}s · 클릭: 1개 제거"
          on:click|stopPropagation={() => removeOneEvent("left", g.time, it.kind, it.unitId)}
        >
          {#if it.unitId}<Icon src={unitIconUrl(it.unitId)} label={it.label} size={13} />{/if}{it.label}{#if it.count > 1}<b> ×{it.count}</b>{/if}
        </button>
      {/each}
    </div>
  {/each}
  {#each rightBuild as g}
    <div class="build right" style="top: {timeToPx(g.time)}px">
      {#each g.items as it}
        <button
          class="chip"
          title="{it.label} @ {g.time}s · 클릭: 1개 제거"
          on:click|stopPropagation={() => removeOneEvent("right", g.time, it.kind, it.unitId)}
        >
          {#if it.unitId}<Icon src={unitIconUrl(it.unitId)} label={it.label} size={13} />{/if}{it.label}{#if it.count > 1}<b> ×{it.count}</b>{/if}
        </button>
      {/each}
    </div>
  {/each}

  <!-- 커서 가로줄 -->
  {#if $hoverTime != null}
    {@const ls = $sims.left.stateAt($hoverTime)}
    {@const rs = $sims.right.stateAt($hoverTime)}
    <div class="guide" style="top: {timeToPx($hoverTime)}px"></div>
    <div class="hover-time" style="top: {timeToPx($hoverTime)}px">{$hoverTime}s</div>
    <div class="readout left hover" class:err={neg(ls)} style="top: {timeToPx($hoverTime)}px"><ResourceReadout s={ls} /></div>
    <div class="readout right hover" class:err={neg(rs)} style="top: {timeToPx($hoverTime)}px"><ResourceReadout s={rs} /></div>
  {/if}
  </div>
</div>

<style>
  .timearea {
    background: #fff;
    /* 0초가 최상단에 붙지 않도록 위·아래 여백 */
    padding: 40px 0 80px;
    min-height: 100%;
  }
  .timeinner {
    position: relative;
    cursor: crosshair;
  }
  .axis {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 6px;
    transform: translateX(-50%);
    background: #b9b9b9;
  }
  .tick {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 22px;
    height: 0;
    border-top: 1px solid #cbd5e1;
    pointer-events: none;
  }
  .tick-label {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -100%);
    font-size: 9px;
    color: #94a3b8;
    background: #fff;
    padding: 0 2px;
  }
  .guide {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 1px dashed #2563eb;
    pointer-events: none;
    z-index: 5;
  }
  .hover-time {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: #2563eb;
    padding: 1px 5px;
    border-radius: 8px;
    pointer-events: none;
    z-index: 6;
  }
  .markerline {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px solid #64748b;
    pointer-events: none;
  }
  .markerline.active {
    border-top-color: #dc2626;
  }
  .marker-dot {
    position: absolute;
    left: 50%;
    width: 14px;
    height: 14px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 2px solid #475569;
    background: #f8fafc;
    padding: 0;
    cursor: pointer;
    z-index: 7;
  }
  .marker-dot.active {
    border-color: #dc2626;
    background: #fee2e2;
  }
  .readout {
    position: absolute;
    transform: translateY(-50%);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    background: #f1f5f9cc;
    padding: 1px 5px;
    border-radius: 3px;
    pointer-events: none;
  }
  .readout.left {
    right: calc(50% + 14px);
    text-align: right;
  }
  .readout.right {
    left: calc(50% + 14px);
  }
  .readout.hover {
    background: #dbeafe;
    color: #1e3a8a;
    z-index: 6;
  }
  .readout.err {
    background: #fecaca;
    color: #7f1d1d;
    font-weight: 700;
  }
  .errmark {
    position: absolute;
    width: 10px;
    height: 10px;
    transform: translateY(-50%) rotate(45deg);
    background: #dc2626;
    z-index: 4;
  }
  .errmark.left {
    left: calc(50% - 16px);
  }
  .errmark.right {
    left: calc(50% + 6px);
  }
  .techmark {
    position: absolute;
    width: 0;
    height: 0;
    transform: translateY(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 11px solid #f59e0b;
    z-index: 4;
  }
  .techmark.left {
    left: calc(50% - 30px);
  }
  .techmark.right {
    left: calc(50% + 20px);
  }
  .build {
    position: absolute;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    max-width: calc(50% - 40px);
    transform: translateY(-50%);
    z-index: 3;
  }
  .build.left {
    left: 8px;
    justify-content: flex-start;
  }
  .build.right {
    right: 8px;
    justify-content: flex-end;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    line-height: 1.4;
    padding: 1px 6px 1px 3px;
    border: 1px solid #94a3b8;
    border-radius: 10px;
    background: #eef2ff;
    color: #1e293b;
    white-space: nowrap;
    cursor: pointer;
  }
  .chip:hover {
    background: #fecaca;
    border-color: #ef4444;
    text-decoration: line-through;
  }
  .chip b {
    color: #2563eb;
  }
</style>
