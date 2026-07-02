<script lang="ts">
  import type { ResourceState } from "../engine/types";
  import { resourceIconUrl } from "../icons";
  import Icon from "./Icon.svelte";

  export let s: ResourceState;
  /** 저그일 때 애벌레 수 (아니면 null). */
  export let larva: number | null = null;

  const min = resourceIconUrl("minerals");
  const gas = resourceIconUrl("gas");
  const sup = resourceIconUrl("supply");
  const lar = resourceIconUrl("larva");
</script>

<span class="ro">
  <Icon src={min} label="M" size={12} /><span>{Math.floor(s.minerals)}</span>
  <Icon src={gas} label="G" size={12} /><span>{Math.floor(s.gas)}</span>
  <Icon src={sup} label="S" size={12} /><span>{s.supplyUsed}/{s.supplyCap}</span>
  {#if larva != null}<Icon src={lar} label="L" size={12} /><span>{larva}</span>{/if}
</span>

<style>
  .ro {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-variant-numeric: tabular-nums;
  }
  .ro span {
    margin-right: 4px;
  }
</style>
