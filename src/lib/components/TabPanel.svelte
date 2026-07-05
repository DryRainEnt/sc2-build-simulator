<script lang="ts">
  import type { Side, TabId } from "../stores/sim";
  import {
    factions,
    patch,
    currentMarker,
    sims,
    setTab,
    setRace,
    queueProduction,
    queueAssign,
    queueTransfer,
    queueDeath,
    queueInject,
    queueAddon,
    removeAddon,
    selectedTrack,
  } from "../stores/sim";
  import { RACES, unitsFor, producibleUnits, categoryOf } from "../patches";
  import { t, un } from "../i18n";
  import { unitIconUrl, resourceIconUrl } from "../icons";
  import Icon from "./Icon.svelte";
  import type { Race, UnitDef } from "../engine/types";

  export let side: Side;

  $: faction = $factions[side];
  $: cur = $currentMarker;

  const tabs: { id: TabId; label: string }[] = [
    { id: "unit", label: "유닛" },
    { id: "building", label: "건물" },
    { id: "upgrade", label: "업글" },
    { id: "action", label: "행동" },
  ];

  $: prodList =
    faction.activeTab === "unit"
      ? producibleUnits($patch, faction.race)
      : faction.activeTab === "building"
        ? unitsFor($patch, faction.race, "building")
        : faction.activeTab === "upgrade"
          ? unitsFor($patch, faction.race, "upgrade")
          : [];

  $: actions = [
    { id: "gas1", label: "가스 일꾼 +1" },
    { id: "min1", label: "미네랄 복귀 +1" },
    { id: "pause", label: "채취 정지" },
    { id: "death", label: "일꾼 사망" },
    ...(faction.race === "zerg" ? [{ id: "inject", label: "퀸 인젝트" }] : []),
  ];

  // 자원 아이콘 (한 번만 해석)
  const icMin = resourceIconUrl("minerals");
  const icGas = resourceIconUrl("gas");
  const icTime = resourceIconUrl("time");

  // 커서 툴팁 상태
  let hovered: UnitDef | null = null;
  let tx = 0;
  let ty = 0;
  let flip = false; // 커서 왼쪽으로 띄우기(우측 진영/화면 오른쪽 끝)

  // 현재 마커 시점의 이 진영 자원 상태 (비용 부족 판정용)
  $: markerState = cur != null ? $sims[side].stateAt(cur) : null;
  $: insufMin = !!(hovered && markerState && hovered.minerals > markerState.minerals);
  $: insufGas = !!(hovered && markerState && hovered.gas > markerState.gas);

  // 애드온 부착 가능한 건물 열이 선택됐는지 (병영/군수공장/우주공항만)
  $: selType = $selectedTrack?.side === side ? $selectedTrack.machineId.split("#")[0] : null;
  $: selAcceptsAddon = !!(selType && $patch.units[selType]?.acceptsAddon);

  function updateTipPos(e: MouseEvent) {
    tx = e.clientX;
    ty = e.clientY;
    // 우측 진영이거나 커서가 화면 오른쪽 끝 근처면 왼쪽으로 뒤집는다.
    flip = side === "right" || tx > window.innerWidth - 210;
  }
  function onEnter(u: UnitDef, e: MouseEvent) {
    hovered = u;
    updateTipPos(e);
  }
  function onMoveTip(e: MouseEvent) {
    updateTipPos(e);
  }
  function onLeaveTip() {
    hovered = null;
  }

  function onRaceChange(e: Event) {
    setRace(side, (e.currentTarget as HTMLSelectElement).value as Race);
  }

  function clickUnit(u: UnitDef) {
    if (cur == null) return;
    if (u.addon) {
      // 애드온: 선택된(같은 진영) 건물 열에 부착. 같은 애드온 다시 클릭 = 제거.
      const sel = $selectedTrack;
      if (!sel || sel.side !== side) return;
      // 병영/군수공장/우주공항에만 부착 가능
      if (!$patch.units[sel.machineId.split("#")[0]]?.acceptsAddon) return;
      const existing = faction.events.find(
        (e): e is Extract<typeof e, { kind: "addon" }> => e.kind === "addon" && e.machineId === sel.machineId,
      );
      if (existing && existing.addon === u.id) removeAddon(side, sel.machineId);
      else queueAddon(side, sel.machineId, cur, u.id as "reactor" | "tech_lab");
      return;
    }
    // 업그레이드/건물은 build_structure(연구/건설) 경로로
    const asStructure = categoryOf(u) === "building" || categoryOf(u) === "upgrade";
    queueProduction(side, u.id, cur, asStructure);
  }

  function clickAction(id: string) {
    if (cur == null) return;
    switch (id) {
      case "gas1":
        queueAssign(side, cur, 1, "gas");
        break;
      case "min1":
        queueAssign(side, cur, 1, "minerals");
        break;
      case "pause":
        // 기본 5초 정지 → 끝 노드를 드래그해 이동거리만큼 조절
        queueTransfer(side, cur, 1, 5);
        break;
      case "death":
        queueDeath(side, cur, "worker", 1);
        break;
      case "inject":
        queueInject(side, cur);
        break;
    }
  }
</script>

<div class="panel {side}">
  <div class="race">
    <select value={faction.race} on:change={onRaceChange}>
      {#each RACES as r}
        <option value={r.id}>{$t(r.label)}</option>
      {/each}
    </select>
  </div>

  <div class="tabs">
    {#each tabs as tab}
      <button class:active={faction.activeTab === tab.id} on:click={() => setTab(side, tab.id)}>
        {$t(tab.label)}
      </button>
    {/each}
  </div>

  <div class="grid" class:icongrid={faction.activeTab !== "action"} class:dim={cur == null}>
    {#if faction.activeTab === "action"}
      {#each actions as a}
        <button class="cell" on:click={() => clickAction(a.id)} title={$t(a.label)}>{$t(a.label)}</button>
      {/each}
    {:else}
      {#each prodList as u}
        <button
          class="iconcell"
          class:addon={u.addon}
          class:armed={u.addon && selAcceptsAddon}
          on:click={() => clickUnit(u)}
          on:mouseenter={(e) => onEnter(u, e)}
          on:mousemove={onMoveTip}
          on:mouseleave={onLeaveTip}
          title={u.addon ? `${$un(u.id, u.name)} — ${$t("건물 열 선택 후 클릭해 부착")}` : $un(u.id, u.name)}
        >
          <Icon src={unitIconUrl(u.id)} label={$un(u.id, u.name)} size={54} />
        </button>
      {/each}
      {#if prodList.length === 0}
        <p class="empty">{$t("데이터 없음")}</p>
      {/if}
    {/if}
  </div>

  {#if cur == null}
    <p class="hint">{$t("시간선을 클릭해 마커를 먼저 배치하세요")}</p>
  {:else}
    <p class="hint">{$t("현재 마커")}: {cur}s</p>
  {/if}
  {#if $selectedTrack?.side === side}
    <p class="hint sel">
      {$t("선택")}: {selType ? $un(selType, $patch.units[selType]?.name ?? selType) : $selectedTrack.machineId}
      {#if selAcceptsAddon}{$t("— 기술실/반응로 클릭해 부착")}{:else}{$t("— 애드온 부착 불가(병영/군수공장/우주공항만)")}{/if}
    </p>
  {/if}
</div>

<!-- 커서 툴팁: 이름 · 미네랄 · 가스 · 시간 (마커에서 자원 부족 시 빨간색) -->
{#if hovered}
  <div class="tip" style="{flip ? `left: ${tx - 14}px; transform: translateX(-100%)` : `left: ${tx + 14}px`}; top: {ty + 16}px">
    <div class="tip-name">{$un(hovered.id, hovered.name)}</div>
    <div class="tip-row">
      <span class="stat" class:short={insufMin}>
        <Icon src={icMin} label="M" size={13} />{hovered.minerals}
      </span>
      {#if hovered.gas > 0}
        <span class="stat" class:short={insufGas}>
          <Icon src={icGas} label="G" size={13} />{hovered.gas}
        </span>
      {/if}
      <span class="stat">
        <Icon src={icTime} label="T" size={13} />{hovered.buildTime}s
      </span>
    </div>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    height: 100%;
    overflow-y: auto;
  }
  .panel.left {
    background: #c9c2ef;
  }
  .panel.right {
    background: #f5c518;
  }
  .race select {
    width: 100%;
    padding: 5px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid #0003;
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tabs button {
    flex: 1;
    padding: 5px 4px;
    font-size: 12px;
    border: 1px solid #0003;
    border-radius: 4px;
    background: #ffffffcc;
    cursor: pointer;
  }
  .tabs button.active {
    background: #fff;
    font-weight: 700;
    box-shadow: 0 0 0 2px #0004 inset;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }
  .grid.icongrid {
    grid-template-columns: repeat(5, 1fr);
    gap: 3px;
  }
  .grid.dim {
    opacity: 0.7;
  }
  /* 유닛/건물: 정사각형 아이콘 버튼 */
  .iconcell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 1px solid #0003;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  .iconcell:hover {
    background: #eef;
    border-color: #0006;
  }
  /* 애드온: 열 선택 전엔 흐리게, 선택되면 활성(armed) */
  .iconcell.addon {
    opacity: 0.5;
    border-style: dashed;
  }
  .iconcell.armed {
    opacity: 1;
    border-style: solid;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px #2563eb33;
  }
  .hint.sel {
    color: #1d4ed8;
    font-weight: 600;
  }
  /* 행동 탭: 텍스트 버튼 */
  .cell {
    padding: 6px;
    font-size: 11px;
    border: 1px solid #0003;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  .cell:hover {
    background: #eef;
  }
  .empty {
    grid-column: 1 / -1;
    color: #0007;
    font-size: 12px;
  }
  .hint {
    margin: 0;
    font-size: 11px;
    color: #0008;
  }
  .tip {
    position: fixed;
    z-index: 50;
    pointer-events: none;
    background: #111827;
    color: #f9fafb;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 12px;
    box-shadow: 0 4px 12px #0006;
    white-space: nowrap;
  }
  .tip-name {
    font-weight: 700;
    margin-bottom: 3px;
  }
  .tip-row {
    display: flex;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .tip .stat {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .tip .stat.short {
    color: #f87171;
    font-weight: 700;
  }
</style>
