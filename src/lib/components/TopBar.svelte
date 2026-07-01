<script lang="ts">
  import { PATCHES, getPatch } from "../patches";
  import { patch } from "../stores/sim";

  let selectedId: string;
  $: selectedId = $patch.id;

  function onSelect(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    patch.set(getPatch(id));
  }

  // 메뉴 버튼 — 골격 단계에선 자리표시자(핸들러 이후 연결).
  const menu = [
    { id: "new-patch", label: "커스텀 패치" },
    { id: "export", label: "내보내기" },
    { id: "import", label: "가져오기" },
    { id: "display", label: "표시 설정" },
  ];
  function onMenu(id: string) {
    // TODO: export/import/커스텀 패치/표시설정 구현
    console.info(`[menu] ${id} (미구현)`);
  }
</script>

<header class="topbar">
  <div class="patch-select">
    <label>
      <span>패치</span>
      <select value={selectedId} on:change={onSelect}>
        {#each PATCHES as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <nav class="menu">
    {#each menu as m}
      <button type="button" on:click={() => onMenu(m.id)}>{m.label}</button>
    {/each}
  </nav>
</header>

<style>
  .topbar {
    display: flex;
    gap: 10px;
    padding: 8px;
    align-items: stretch;
  }
  .patch-select {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    background: #7fd6f0;
    border: 2px solid #2aa9d4;
    border-radius: 6px;
  }
  .patch-select label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #08415c;
  }
  select {
    font-size: 13px;
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid #2aa9d4;
    background: #fff;
  }
  .menu {
    flex: 1;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 10px;
    background: #a7d70b;
    border: 2px solid #6fa300;
    border-radius: 6px;
  }
  .menu button {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 12px;
    border: 1px solid #4f7a00;
    border-radius: 4px;
    background: #fff;
    color: #33500a;
    cursor: pointer;
  }
  .menu button:hover {
    background: #eaffb0;
  }
</style>
