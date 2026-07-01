<script lang="ts">
  import type { ResourceState } from "../engine/types";
  import { resourceIconUrl } from "../icons";
  import Icon from "./Icon.svelte";

  export let s: ResourceState;

  const min = resourceIconUrl("minerals");
  const gas = resourceIconUrl("gas");
  const sup = resourceIconUrl("supply");
</script>

<span class="ro">
  <Icon src={min} label="M" size={12} /><span>{Math.floor(s.minerals)}</span>
  <Icon src={gas} label="G" size={12} /><span>{Math.floor(s.gas)}</span>
  <Icon src={sup} label="S" size={12} /><span>{s.supplyUsed}/{s.supplyCap}</span>
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
