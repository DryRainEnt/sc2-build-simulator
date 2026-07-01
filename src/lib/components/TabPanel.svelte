<script lang="ts">
  import type { Side, TabId } from "../stores/sim";
  import {
    factions,
    patch,
    currentMarker,
    setTab,
    setRace,
    queueProduction,
    queueAssign,
    queueTransfer,
    queueDeath,
  } from "../stores/sim";
  import { RACES, unitsFor, producibleUnits, categoryOf } from "../patches";
  import type { Race } from "../engine/types";

  export let side: Side;

  $: faction = $factions[side];
  $: cur = $currentMarker;

  const tabs: { id: TabId; label: string }[] = [
    { id: "unit", label: "유닛" },
    { id: "building", label: "건물" },
    { id: "action", label: "행동" },
  ];

  $: prodList =
    faction.activeTab === "action"
      ? []
      : faction.activeTab === "unit"
        ? producibleUnits($patch, faction.race)
        : unitsFor($patch, faction.race, "building");

  const actions = [
    { id: "gas3", label: "가스 배치 3" },
    { id: "pause", label: "채취정지 10s" },
    { id: "death", label: "일꾼 사망" },
  ];

  function onRaceChange(e: Event) {
    setRace(side, (e.currentTarget as HTMLSelectElement).value as Race);
  }

  function clickUnit(unitId: string, isStructure: boolean) {
    if (cur == null) return;
    queueProduction(side, unitId, cur, isStructure);
  }

  function clickAction(id: string) {
    if (cur == null) return;
    switch (id) {
      case "gas3":
        queueAssign(side, cur, 3, "gas");
        break;
      case "pause":
        queueTransfer(side, cur, 3, 10);
        break;
      case "death":
        queueDeath(side, cur, "worker", 1);
        break;
    }
  }
</script>

<div class="panel {side}">
  <div class="race">
    <select value={faction.race} on:change={onRaceChange}>
      {#each RACES as r}
        <option value={r.id}>{r.label}</option>
      {/each}
    </select>
  </div>

  <div class="tabs">
    {#each tabs as t}
      <button class:active={faction.activeTab === t.id} on:click={() => setTab(side, t.id)}>
        {t.label}
      </button>
    {/each}
  </div>

  <div class="grid" class:disabled={cur == null}>
    {#if faction.activeTab === "action"}
      {#each actions as a}
        <button class="cell" on:click={() => clickAction(a.id)} title={a.label}>{a.label}</button>
      {/each}
    {:else}
      {#each prodList as u}
        <button class="cell" on:click={() => clickUnit(u.id, categoryOf(u) === "building")} title={`${u.name} · ${u.minerals}m${u.gas ? "/" + u.gas + "g" : ""}`}>
          <span class="nm">{u.name}</span>
          <span class="cost">{u.minerals}m{u.gas ? `/${u.gas}g` : ""}</span>
        </button>
      {/each}
      {#if prodList.length === 0}
        <p class="empty">데이터 없음</p>
      {/if}
    {/if}
  </div>

  {#if cur == null}
    <p class="hint">시간선을 클릭해 마커를 먼저 배치하세요</p>
  {:else}
    <p class="hint">현재 마커: {cur}s</p>
  {/if}
</div>

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
  .grid.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 6px;
    font-size: 11px;
    text-align: left;
    border: 1px solid #0003;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  .cell:hover {
    background: #eef;
  }
  .cell .nm {
    font-weight: 600;
  }
  .cell .cost {
    color: #555;
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
</style>
