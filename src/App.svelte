<script lang="ts">
  import TopBar from "./lib/components/TopBar.svelte";
  import TabPanel from "./lib/components/TabPanel.svelte";
  import TimeArea from "./lib/components/TimeArea.svelte";
  import TimelineStats from "./lib/components/TimelineStats.svelte";
  import { displaySettings } from "./lib/stores/sim";
</script>

<div class="app" class:dark={$displaySettings.dark} style="zoom: {($displaySettings.scale ?? 100) / 100}">
  <TopBar />

  <div class="sim">
    <aside class="tabcol">
      <TabPanel side="left" />
    </aside>

    <div class="timecol">
      <TimelineStats />
      <div class="timescroll">
        <TimeArea />
      </div>
    </div>

    <aside class="tabcol">
      <TabPanel side="right" />
    </aside>
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .sim {
    flex: 1;
    display: grid;
    grid-template-columns: 320px 1fr 320px;
    min-height: 0;
    border-top: 2px solid #d4d4d8;
  }
  .tabcol {
    min-height: 0;
    overflow: hidden;
    border-inline: 2px solid #d4d4d8;
  }
  .timecol {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .timescroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
</style>
