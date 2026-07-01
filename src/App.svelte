<script lang="ts">
  import TopBar from "./lib/components/TopBar.svelte";
  import TabPanel from "./lib/components/TabPanel.svelte";
  import TimeArea from "./lib/components/TimeArea.svelte";
</script>

<div class="app">
  <TopBar />

  <div class="sim">
    <aside class="tabcol">
      <TabPanel side="left" />
    </aside>

    <div class="timescroll">
      <TimeArea />
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
    grid-template-columns: 220px 1fr 220px;
    min-height: 0;
    border-top: 2px solid #d4d4d8;
  }
  .tabcol {
    min-height: 0;
    overflow: hidden;
    border-inline: 2px solid #d4d4d8;
  }
  .timescroll {
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
</style>
