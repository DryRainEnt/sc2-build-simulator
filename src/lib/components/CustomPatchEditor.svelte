<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { saveCustomPatch } from "../stores/sim";
  import type { PatchData, UnitDef } from "../engine/types";
  import { t } from "../i18n";

  export let base: PatchData;
  const dispatch = createEventDispatcher();

  // 깊은 복사본을 편집. 내장 패치 기반이면 새 id/이름 부여.
  const draft: PatchData = structuredClone(base);
  if (!draft.larva) draft.larva = { spawnSeconds: 9.9, perBase: 3 };
  const larva = draft.larva; // 비-undefined 참조 (draft.larva와 동일 객체)
  const isCustomBase = base.id.startsWith("custom-");
  const draftId = isCustomBase ? base.id : `custom-${Date.now()}`;
  let name = isCustomBase ? base.name : `커스텀 (${base.name} 기반)`;

  $: units = Object.values(draft.units).sort(
    (a, b) => a.race.localeCompare(b.race) || a.name.localeCompare(b.name),
  );

  const OPT: (keyof UnitDef)[] = ["supplyProvided", "startCount", "larvaCost", "warpCooldown"];

  function save() {
    for (const u of Object.values(draft.units)) {
      for (const k of OPT) {
        const v = u[k] as unknown;
        if (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) {
          delete u[k];
        }
      }
    }
    draft.id = draftId;
    draft.name = name.trim() || draftId;
    saveCustomPatch(draft);
    dispatch("close");
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="overlay" on:click={() => dispatch("close")}>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="editor" on:click|stopPropagation>
    <header>
      <h3>{$t("커스텀 패치 작성")}</h3>
      <label class="pname">{$t("이름")} <input bind:value={name} /></label>
      <div class="spacer"></div>
      <button class="primary" on:click={save}>{$t("저장 & 적용")}</button>
      <button on:click={() => dispatch("close")}>{$t("취소")}</button>
    </header>

    <div class="body">
      <section class="globals">
        <fieldset>
          <legend>{$t("채취/자원")}</legend>
          <label>{$t("패치당 일꾼 채취/초")} <input type="number" step="0.001" bind:value={draft.harvest.mineralPerWorker} /></label>
          <label>{$t("포화 3번째/초")} <input type="number" step="0.001" bind:value={draft.harvest.mineralPerWorkerSaturated} /></label>
          <label>{$t("가스 일꾼/초(1·2번째)")} <input type="number" step="0.001" bind:value={draft.harvest.gasPerWorker} /></label>
          <label>{$t("가스 포화/초(3번째)")} <input type="number" step="0.001" bind:value={draft.harvest.gasPerWorkerSaturated} /></label>
          <label>{$t("미네랄 왕복량")} <input type="number" bind:value={draft.harvest.mineralsPerTrip} /></label>
          <label>{$t("가스 왕복량")} <input type="number" bind:value={draft.harvest.gasPerTrip} /></label>
          <label>{$t("패치당 정상 일꾼")} <input type="number" bind:value={draft.harvest.workersPerMineralPatch} /></label>
          <label>{$t("패치당 최대 일꾼")} <input type="number" bind:value={draft.harvest.maxWorkersPerMineralPatch} /></label>
          <label>{$t("간헐천 정상 일꾼")} <input type="number" bind:value={draft.harvest.workersPerGeyser} /></label>
          <label>{$t("간헐천 최대 일꾼")} <input type="number" bind:value={draft.harvest.maxWorkersPerGeyser} /></label>
        </fieldset>
        <fieldset>
          <legend>{$t("시작/기지")}</legend>
          <label>{$t("시작 미네랄")} <input type="number" bind:value={draft.start.minerals} /></label>
          <label>{$t("시작 가스")} <input type="number" bind:value={draft.start.gas} /></label>
          <label>{$t("시작 일꾼")} <input type="number" bind:value={draft.start.workers} /></label>
          <label>{$t("미네랄 패치 수")} <input type="number" bind:value={draft.base.mineralPatches} /></label>
          <label>{$t("간헐천 수")} <input type="number" bind:value={draft.base.geysers} /></label>
        </fieldset>
        <fieldset>
          <legend>{$t("애벌레/워프")}</legend>
          <label>{$t("애벌레 생성(초)")} <input type="number" step="0.1" bind:value={larva.spawnSeconds} /></label>
          <label>{$t("기지당 애벌레")} <input type="number" bind:value={larva.perBase} /></label>
          <label>{$t("인젝트 애벌레")} <input type="number" bind:value={larva.injectAmount} /></label>
          <label>{$t("워프인(초)")} <input type="number" bind:value={draft.warpInSeconds} /></label>
        </fieldset>
      </section>

      <section class="units">
        <table>
          <thead>
            <tr>
              <th class="nm">{$t("유닛")}</th><th>{$t("종족")}</th><th>{$t("미네랄")}</th><th>{$t("가스")}</th><th>{$t("보급")}</th>
              <th>{$t("보급공급")}</th><th>{$t("생산시간")}</th><th>{$t("시작수")}</th><th>{$t("애벌레")}</th><th>{$t("워프쿨")}</th>
            </tr>
          </thead>
          <tbody>
            {#each units as u (u.id)}
              <tr>
                <td class="nm">{u.name}</td>
                <td class="race {u.race}">{u.race[0].toUpperCase()}</td>
                <td><input type="number" bind:value={u.minerals} /></td>
                <td><input type="number" bind:value={u.gas} /></td>
                <td><input type="number" step="0.5" bind:value={u.supply} /></td>
                <td><input type="number" bind:value={u.supplyProvided} /></td>
                <td><input type="number" bind:value={u.buildTime} /></td>
                <td><input type="number" bind:value={u.startCount} /></td>
                <td><input type="number" step="0.5" bind:value={u.larvaCost} /></td>
                <td><input type="number" bind:value={u.warpCooldown} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: #0007;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .editor {
    width: 94vw;
    height: 92vh;
    background: #fff;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 12px 48px #0006;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
  }
  header h3 {
    margin: 0;
  }
  .pname input {
    width: 260px;
    padding: 5px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
  }
  .spacer {
    flex: 1;
  }
  header button {
    padding: 7px 14px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #fff;
    cursor: pointer;
  }
  header .primary {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
    font-weight: 600;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 12px 16px;
  }
  .globals {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  fieldset {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px 12px 10px;
  }
  legend {
    font-weight: 700;
    font-size: 13px;
    padding: 0 4px;
  }
  fieldset label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    margin: 4px 0;
  }
  fieldset input {
    width: 90px;
    padding: 3px 5px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    text-align: right;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 12px;
  }
  th,
  td {
    border: 1px solid #eef1f5;
    padding: 2px 4px;
    text-align: center;
  }
  thead th {
    position: sticky;
    top: 0;
    background: #f1f5f9;
    z-index: 1;
  }
  td.nm,
  th.nm {
    text-align: left;
    white-space: nowrap;
  }
  td.race {
    font-weight: 700;
  }
  td.race.terran {
    color: #b45309;
  }
  td.race.protoss {
    color: #7c3aed;
  }
  td.race.zerg {
    color: #be185d;
  }
  td input {
    width: 58px;
    padding: 2px 3px;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    text-align: right;
  }
  td input:focus {
    border-color: #2563eb;
    outline: none;
  }
</style>
