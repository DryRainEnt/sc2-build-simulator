<script lang="ts">
  import { sims, hoverTime, currentMarker, displaySettings } from "../stores/sim";
  import { formatTime } from "../config";
  import { t } from "../i18n";
  import { resourceIconUrl } from "../icons";
  import Icon from "./Icon.svelte";
  import type { ResourceState } from "../engine/types";

  const icMin = resourceIconUrl("minerals");
  const icGas = resourceIconUrl("gas");

  // 표시 기준 시각: 커서(hover) 우선, 없으면 현재 마커, 없으면 0
  $: t0 = $hoverTime ?? $currentMarker ?? 0;
  $: ls = $sims.left.stateAt(t0);
  $: rs = $sims.right.stateAt(t0);

  const army = (s: ResourceState) => Math.max(0, Math.round(s.supplyUsed - s.workers));
  const perMin = (rate: number) => Math.round(rate * 60);
</script>

<div class="statsbar">
  {#each [ls, rs] as s, i}
    {#if i === 1}<div class="mid">{formatTime(Math.round(t0), $displaySettings.timeFormat)}</div>{/if}
    <div class="fac" class:right={i === 1}>
      <span class="stat" title={$t("일꾼")}><span class="emo">🔧</span><b>{s.workers}</b></span>
      <span class="stat"><Icon src={icMin} label="M" size={14} /><b>{s.mineralWorkers}</b><em>{perMin(s.mineralRate)}{$t("/분")}</em></span>
      <span class="stat"><Icon src={icGas} label="G" size={14} /><b>{s.gasWorkers}</b><em>{perMin(s.gasRate)}{$t("/분")}</em></span>
      <span class="stat sup" title={$t("병력")}><span class="emo">⚔️</span><b>{army(s)}</b></span>
      <span class="stat sup"><span class="lbl">{$t("인구")}</span><b>{s.supplyUsed}/{s.supplyCap}</b></span>
    </div>
  {/each}
</div>

<style>
  .statsbar {
    display: flex;
    align-items: stretch;
    height: 30px;
    font-size: 12px;
    background: #e8edf2;
    border-bottom: 2px solid #cbd5e1;
    user-select: none;
  }
  .fac {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 8px;
    min-width: 0;
    overflow: hidden;
  }
  .fac.right {
    flex-direction: row-reverse;
  }
  .mid {
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #475569;
    background: #dbe3ea;
  }
  .stat {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  .stat b {
    font-variant-numeric: tabular-nums;
  }
  .stat em {
    font-style: normal;
    color: #64748b;
    font-size: 11px;
  }
  .emo {
    font-size: 13px;
    line-height: 1;
  }
  .stat .lbl {
    color: #64748b;
  }
</style>
