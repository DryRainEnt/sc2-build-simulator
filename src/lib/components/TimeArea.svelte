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
    removeEventByIndex,
    setPauseDuration,
    setEventTimes,
    selectedTrack,
    selectTrack,
    displaySettings,
  } from "../stores/sim";
  import type { BuildEvent, ResourceState } from "../engine/types";
  import type { Side } from "../stores/sim";
  import { summarizeBuild, timelineBars, facilityTracks, contiguousBlock, idleIntervals, type TimelineBar } from "../buildSummary";
  import { computeLarva } from "../engine/larva";
  import { unitIconUrl } from "../icons";
  import Icon from "./Icon.svelte";
  import ResourceReadout from "./ResourceReadout.svelte";
  import LarvaGraph from "./LarvaGraph.svelte";

  const nameOf = (id: string) => $patch.units[id]?.name ?? id;
  const missingLabel = (missing: string[]) => missing.map(nameOf).join(", ");

  // 순간 행동(칩)으로 표시할 것: 일꾼 배치/사망 (채취정지는 드래그 막대로)
  const isChipAction = (e: BuildEvent) =>
    e.kind === "assign_worker" || e.kind === "unit_death" || e.kind === "inject";

  // 생산/건설/정지 = 기간 막대(한 레인 체계, 실제 시작~완료), 배치/사망 = 순간 칩
  $: leftBars = timelineBars($factions.left.events, $patch, $factions.left.race);
  $: rightBars = timelineBars($factions.right.events, $patch, $factions.right.race);
  $: leftActions = summarizeBuild($factions.left.events.filter(isChipAction), $patch);
  $: rightActions = summarizeBuild($factions.right.events.filter(isChipAction), $patch);

  // 생산 건물 유휴 구간(빌드 최적화용)
  $: leftIdle = idleIntervals(leftBars);
  $: rightIdle = idleIntervals(rightBars);

  // 건물 트랙 헤더/애드온
  $: leftTracks = facilityTracks($factions.left.events, $patch, $factions.left.race);
  $: rightTracks = facilityTracks($factions.right.events, $patch, $factions.right.race);
  const isSelected = (side: Side, mid: string) =>
    $selectedTrack?.side === side && $selectedTrack?.machineId === mid;
  const iconOfType = (type: string) => unitIconUrl(type);
  const bandWidth = (laneCount: number) => (laneCount - 1) * LANE_W + 28;

  // 저그 애벌레 (자원 표시용)
  $: leftLarva = computeLarva($factions.left.events, $patch, $factions.left.race);
  $: rightLarva = computeLarva($factions.right.events, $patch, $factions.right.race);
  function lv(side: Side, t: number): number | null {
    if ($factions[side].race !== "zerg") return null;
    return Math.floor((side === "left" ? leftLarva : rightLarva).larvaAt(t));
  }

  // 레인 → 중앙축에서의 픽셀 오프셋
  const LANE_BASE = 42;
  const LANE_W = 32;
  const laneOffset = (lane: number) => LANE_BASE + lane * LANE_W;

  // 채취정지 끝 노드 드래그: 지속시간 조절
  let drag: { side: Side; index: number; start: number } | null = null;
  function startDrag(side: Side, index: number, start: number, e: PointerEvent) {
    drag = { side, index, start };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function moveDrag(e: PointerEvent) {
    if (!drag) return;
    const t = yToTime(e.clientY);
    setPauseDuration(drag.side, drag.index, t - drag.start);
    e.stopPropagation();
  }
  function endDrag(e: PointerEvent) {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    drag = null;
    e.stopPropagation();
  }

  // 생산 막대 드래그: 같은 건물의 연속(back-to-back) 블록을 함께 이동. 안 움직이면 클릭=제거.
  let prodDrag:
    | { side: Side; block: number[]; origTimes: number[]; anchorStart: number; y0: number; moved: boolean }
    | null = null;
  function prodDown(side: Side, bar: TimelineBar, e: PointerEvent) {
    const bars = side === "left" ? leftBars : rightBars;
    const block = contiguousBlock(bars, bar);
    const evs = $factions[side].events;
    prodDrag = {
      side,
      block,
      origTimes: block.map((i) => evs[i].time),
      anchorStart: bar.start,
      y0: e.clientY,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function prodMove(e: PointerEvent) {
    if (!prodDrag) return;
    if (Math.abs(e.clientY - prodDrag.y0) > 4) prodDrag.moved = true;
    if (!prodDrag.moved) return;
    const delta = yToTime(e.clientY) - prodDrag.anchorStart;
    setEventTimes(
      prodDrag.side,
      prodDrag.block.map((idx, k) => ({ index: idx, time: prodDrag!.origTimes[k] + delta })),
    );
    e.stopPropagation();
  }
  function prodUp(e: PointerEvent) {
    if (!prodDrag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    prodDrag = null;
    e.stopPropagation();
  }

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

  <!-- 저그 애벌레 그래프 (배경 밴드) -->
  {#if $displaySettings.showLarva && $factions.left.race === "zerg"}
    <LarvaGraph larva={leftLarva} duration={$duration} side="left" />
  {/if}
  {#if $displaySettings.showLarva && $factions.right.race === "zerg"}
    <LarvaGraph larva={rightLarva} duration={$duration} side="right" />
  {/if}

  <!-- 자원 부족 오류 마커 (진영별) -->
  {#each $sims.left.errors as err}
    <div class="errmark left" style="top: {timeToPx(err.time)}px" title="자원 부족: {err.resource} -{Math.ceil(err.deficit)}"></div>
  {/each}
  {#each $sims.right.errors as err}
    <div class="errmark right" style="top: {timeToPx(err.time)}px" title="자원 부족: {err.resource} -{Math.ceil(err.deficit)}"></div>
  {/each}

  <!-- 테크 선행조건 경고 마커 (진영별) -->
  {#if $displaySettings.showTech}
  {#each $sims.left.techWarnings as w}
    <div class="techmark left" style="top: {timeToPx(w.time)}px" title="{nameOf(w.unitId)}: 선행 부족 → {missingLabel(w.missing)}"></div>
  {/each}
  {#each $sims.right.techWarnings as w}
    <div class="techmark right" style="top: {timeToPx(w.time)}px" title="{nameOf(w.unitId)}: 선행 부족 → {missingLabel(w.missing)}"></div>
  {/each}
  {/if}

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
    <div class="readout left" class:err={neg(ls)} style="top: {timeToPx(m)}px"><ResourceReadout s={ls} larva={lv("left", m)} /></div>
    <div class="readout right" class:err={neg(rs)} style="top: {timeToPx(m)}px"><ResourceReadout s={rs} larva={lv("right", m)} /></div>
  {/each}

  <!-- 건물 트랙: 선택 시 열 전체 세로 틴트 + 헤더(아이콘/애드온 배지) -->
  {#each leftTracks as t}
    {#if isSelected("left", t.machineId)}
      <div class="track-tint" style="top: 0; height: {height}px; right: calc(50% + {laneOffset(t.lane)}px); width: {bandWidth(t.laneCount)}px"></div>
    {/if}
    <button class="track-head left" class:sel={isSelected("left", t.machineId)} style="right: calc(50% + {laneOffset(t.lane)}px)" title="{$patch.units[t.type]?.name ?? t.type} · 클릭: 선택(애드온 부착)" on:click|stopPropagation={() => selectTrack("left", t.machineId)}>
      <Icon src={iconOfType(t.type)} label={t.type} size={18} />
      {#if t.hasReactor}<span class="rbadge react">R</span>{/if}
      {#if t.hasTechLab}<span class="rbadge tech">T</span>{/if}
    </button>
  {/each}
  {#each rightTracks as t}
    {#if isSelected("right", t.machineId)}
      <div class="track-tint" style="top: 0; height: {height}px; left: calc(50% + {laneOffset(t.lane)}px); width: {bandWidth(t.laneCount)}px"></div>
    {/if}
    <button class="track-head right" class:sel={isSelected("right", t.machineId)} style="left: calc(50% + {laneOffset(t.lane)}px)" title="{$patch.units[t.type]?.name ?? t.type} · 클릭: 선택(애드온 부착)" on:click|stopPropagation={() => selectTrack("right", t.machineId)}>
      <Icon src={iconOfType(t.type)} label={t.type} size={18} />
      {#if t.hasReactor}<span class="rbadge react">R</span>{/if}
      {#if t.hasTechLab}<span class="rbadge tech">T</span>{/if}
    </button>
  {/each}

  <!-- 생산 건물 유휴 구간 (빗금) -->
  {#if $displaySettings.showIdle}
    {#each leftIdle as band}
      <div class="idle" style="top: {timeToPx(band.start)}px; height: {timeToPx(band.end - band.start)}px; right: calc(50% + {laneOffset(band.lane)}px)" title="유휴 {Math.round(band.end - band.start)}s"></div>
    {/each}
    {#each rightIdle as band}
      <div class="idle" style="top: {timeToPx(band.start)}px; height: {timeToPx(band.end - band.start)}px; left: calc(50% + {laneOffset(band.lane)}px)" title="유휴 {Math.round(band.end - band.start)}s"></div>
    {/each}
  {/if}

  <!-- 기간 막대: 생산(대기선→아이콘→완료원) / 채취정지(드래그 구간) -->
  {#each leftBars as bar (bar.kind + bar.eventIndex)}
    {#if bar.kind === "prod"}
      {#if bar.orderTime < bar.start}
        <div class="prod-wait" style="top: {timeToPx(bar.orderTime)}px; height: {timeToPx(bar.start - bar.orderTime)}px; right: calc(50% + {laneOffset(bar.lane)}px)" title="큐 대기 {bar.orderTime}s → 시작 {bar.start}s"></div>
      {/if}
      <div class="prod left" style="top: {timeToPx(bar.start)}px; height: {timeToPx(bar.end - bar.start)}px; right: calc(50% + {laneOffset(bar.lane)}px)">
        <div class="prod-stem"></div>
        <div class="prod-dot" title="완료 {bar.end}s"></div>
        <button class="prod-icon" title="{bar.label} · 주문 {bar.orderTime}s · 생산 {bar.start}s → {bar.end}s · 드래그: 블록 이동 · 더블클릭: 제거" on:pointerdown={(e) => prodDown("left", bar, e)} on:pointermove={prodMove} on:pointerup={prodUp} on:dblclick|stopPropagation={() => removeEventByIndex("left", bar.eventIndex)} on:dragstart|preventDefault={() => {}} on:click|stopPropagation={() => {}}>
          <Icon src={unitIconUrl(bar.unitId)} label={bar.label ?? ""} size={24} />
        </button>
      </div>
    {:else if bar.kind === "addon"}
      <div class="prod addon left" style="top: {timeToPx(bar.start)}px; height: {timeToPx(bar.end - bar.start)}px; right: calc(50% + {laneOffset(bar.lane)}px)">
        <div class="prod-stem"></div>
        <div class="prod-dot" title="완료 {bar.end}s"></div>
        <button class="prod-icon addon-icon" class:react={bar.unitId === "reactor"} class:tech={bar.unitId === "tech_lab"} title="{bar.label} · {bar.start}s → {bar.end}s · 더블클릭: 제거" on:dblclick|stopPropagation={() => removeEventByIndex("left", bar.eventIndex)} on:dragstart|preventDefault={() => {}} on:click|stopPropagation={() => {}}>
          <Icon src={unitIconUrl(bar.unitId)} label={bar.label ?? ""} size={20} />
        </button>
      </div>
    {:else}
      <div class="pause left" style="top: {timeToPx(bar.start)}px; height: {timeToPx(bar.end - bar.start)}px; right: calc(50% + {laneOffset(bar.lane)}px)">
        <div class="pause-stem"></div>
        <button class="pause-node start" title="채취정지 시작 {bar.start}s · 클릭: 삭제" on:click|stopPropagation={() => removeEventByIndex("left", bar.eventIndex)}></button>
        <button class="pause-node end" title="정지 해제 {bar.end}s (지속 {bar.end - bar.start}s) · 드래그로 조절" on:pointerdown={(e) => startDrag("left", bar.eventIndex, bar.start, e)} on:pointermove={moveDrag} on:pointerup={endDrag} on:click|stopPropagation={() => {}}></button>
        <div class="pause-label">정지 {bar.end - bar.start}s</div>
      </div>
    {/if}
  {/each}
  {#each rightBars as bar (bar.kind + bar.eventIndex)}
    {#if bar.kind === "prod"}
      {#if bar.orderTime < bar.start}
        <div class="prod-wait" style="top: {timeToPx(bar.orderTime)}px; height: {timeToPx(bar.start - bar.orderTime)}px; left: calc(50% + {laneOffset(bar.lane)}px)" title="큐 대기 {bar.orderTime}s → 시작 {bar.start}s"></div>
      {/if}
      <div class="prod right" style="top: {timeToPx(bar.start)}px; height: {timeToPx(bar.end - bar.start)}px; left: calc(50% + {laneOffset(bar.lane)}px)">
        <div class="prod-stem"></div>
        <div class="prod-dot" title="완료 {bar.end}s"></div>
        <button class="prod-icon" title="{bar.label} · 주문 {bar.orderTime}s · 생산 {bar.start}s → {bar.end}s · 드래그: 블록 이동 · 더블클릭: 제거" on:pointerdown={(e) => prodDown("right", bar, e)} on:pointermove={prodMove} on:pointerup={prodUp} on:dblclick|stopPropagation={() => removeEventByIndex("right", bar.eventIndex)} on:dragstart|preventDefault={() => {}} on:click|stopPropagation={() => {}}>
          <Icon src={unitIconUrl(bar.unitId)} label={bar.label ?? ""} size={24} />
        </button>
      </div>
    {:else if bar.kind === "addon"}
      <div class="prod addon right" style="top: {timeToPx(bar.start)}px; height: {timeToPx(bar.end - bar.start)}px; left: calc(50% + {laneOffset(bar.lane)}px)">
        <div class="prod-stem"></div>
        <div class="prod-dot" title="완료 {bar.end}s"></div>
        <button class="prod-icon addon-icon" class:react={bar.unitId === "reactor"} class:tech={bar.unitId === "tech_lab"} title="{bar.label} · {bar.start}s → {bar.end}s · 더블클릭: 제거" on:dblclick|stopPropagation={() => removeEventByIndex("right", bar.eventIndex)} on:dragstart|preventDefault={() => {}} on:click|stopPropagation={() => {}}>
          <Icon src={unitIconUrl(bar.unitId)} label={bar.label ?? ""} size={20} />
        </button>
      </div>
    {:else}
      <div class="pause right" style="top: {timeToPx(bar.start)}px; height: {timeToPx(bar.end - bar.start)}px; left: calc(50% + {laneOffset(bar.lane)}px)">
        <div class="pause-stem"></div>
        <button class="pause-node start" title="채취정지 시작 {bar.start}s · 클릭: 삭제" on:click|stopPropagation={() => removeEventByIndex("right", bar.eventIndex)}></button>
        <button class="pause-node end" title="정지 해제 {bar.end}s (지속 {bar.end - bar.start}s) · 드래그로 조절" on:pointerdown={(e) => startDrag("right", bar.eventIndex, bar.start, e)} on:pointermove={moveDrag} on:pointerup={endDrag} on:click|stopPropagation={() => {}}></button>
        <div class="pause-label">정지 {bar.end - bar.start}s</div>
      </div>
    {/if}
  {/each}

  <!-- 행동(일꾼 배치/사망) 칩 -->
  {#each leftActions as g}
    <div class="build left" style="top: {timeToPx(g.time)}px">
      {#each g.items as it}
        <button class="chip" title="{it.label} @ {g.time}s · 클릭: 1개 제거" on:click|stopPropagation={() => removeOneEvent("left", g.time, it.kind, it.unitId)}>
          {it.label}{#if it.count > 1}<b> ×{it.count}</b>{/if}
        </button>
      {/each}
    </div>
  {/each}
  {#each rightActions as g}
    <div class="build right" style="top: {timeToPx(g.time)}px">
      {#each g.items as it}
        <button class="chip" title="{it.label} @ {g.time}s · 클릭: 1개 제거" on:click|stopPropagation={() => removeOneEvent("right", g.time, it.kind, it.unitId)}>
          {it.label}{#if it.count > 1}<b> ×{it.count}</b>{/if}
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
    <div class="readout left hover" class:err={neg(ls)} style="top: {timeToPx($hoverTime)}px"><ResourceReadout s={ls} larva={lv("left", $hoverTime)} /></div>
    <div class="readout right hover" class:err={neg(rs)} style="top: {timeToPx($hoverTime)}px"><ResourceReadout s={rs} larva={lv("right", $hoverTime)} /></div>
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
  /* 생산 기간 막대 */
  .prod {
    position: absolute;
    width: 26px;
    z-index: 3;
  }
  .prod-stem {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background: #94a3b8;
  }
  .prod-dot {
    position: absolute;
    bottom: -5px;
    left: 50%;
    width: 10px;
    height: 10px;
    transform: translateX(-50%);
    border-radius: 50%;
    border: 2px solid #94a3b8;
    background: #fff;
  }
  .prod-icon {
    position: absolute;
    top: -13px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px;
    border: 1px solid #0004;
    border-radius: 6px;
    background: #fff;
    cursor: grab;
    touch-action: none;
    box-shadow: 0 1px 2px #0003;
  }
  .prod-icon:active {
    cursor: grabbing;
  }
  .prod-icon:hover {
    border-color: #2563eb;
    background: #dbeafe;
  }
  .addon-icon {
    cursor: pointer;
  }
  .addon-icon.react {
    border-color: #16a34a;
    box-shadow: 0 0 0 1px #16a34a55;
  }
  .addon-icon.tech {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px #2563eb55;
  }
  /* 건물 트랙 헤더 */
  .track-head {
    position: absolute;
    top: -30px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    background: #fff;
    cursor: pointer;
    z-index: 8;
  }
  .track-head.left {
    transform: translateX(50%);
  }
  .track-head.right {
    transform: translateX(-50%);
  }
  .track-head:hover {
    border-color: #64748b;
  }
  .track-head.sel {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px #2563eb55;
  }
  .rbadge {
    font-size: 8px;
    font-weight: 800;
    color: #fff;
    border-radius: 3px;
    padding: 0 2px;
    line-height: 12px;
  }
  .rbadge.react {
    background: #16a34a;
  }
  .rbadge.tech {
    background: #2563eb;
  }
  /* 선택된 건물 열 세로 틴트 */
  .track-tint {
    position: absolute;
    background: #2563eb14;
    border-inline: 1px solid #2563eb44;
    z-index: 0;
    pointer-events: none;
  }
  /* 생산 건물 유휴 구간 (빗금) */
  .idle {
    position: absolute;
    width: 26px;
    z-index: 1;
    border-radius: 3px;
    background: repeating-linear-gradient(
      45deg,
      #fca5a555,
      #fca5a555 4px,
      #fca5a522 4px,
      #fca5a522 8px
    );
    pointer-events: none;
  }
  /* 생산 큐 대기선 (주문~실제시작, 건물 바쁨) */
  .prod-wait {
    position: absolute;
    width: 0;
    border-left: 2px dotted #cbd5e1;
    z-index: 2;
  }
  /* 채취정지 구간 (드래그로 기간 조절) */
  .pause {
    position: absolute;
    width: 20px;
    z-index: 3;
  }
  .pause-stem {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 4px;
    transform: translateX(-50%);
    background: repeating-linear-gradient(#f59e0b, #f59e0b 4px, transparent 4px, transparent 7px);
  }
  .pause-node {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: #f59e0b;
    border: 2px solid #b45309;
    padding: 0;
  }
  .pause-node.start {
    top: -4px;
    width: 8px;
    height: 8px;
    cursor: pointer;
  }
  .pause-node.end {
    bottom: -8px;
    width: 14px;
    height: 14px;
    cursor: ns-resize;
    touch-action: none;
  }
  .pause-node.end:hover {
    background: #fbbf24;
  }
  .pause-label {
    position: absolute;
    bottom: -10px;
    left: 18px;
    font-size: 9px;
    font-weight: 700;
    color: #b45309;
    white-space: nowrap;
    pointer-events: none;
  }
  .pause.right .pause-label {
    left: auto;
    right: 18px;
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
