<script lang="ts">
  import { PATCHES, getPatch } from "../patches";
  import { patch, encodeBuild, importBuild } from "../stores/sim";

  let selectedId: string;
  $: selectedId = $patch.id;

  function onSelect(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    patch.set(getPatch(id));
  }

  const menu = [
    { id: "new-patch", label: "커스텀 패치" },
    { id: "export", label: "내보내기" },
    { id: "import", label: "가져오기" },
    { id: "display", label: "표시 설정" },
  ];

  let modal: "export" | "import" | null = null;
  let codeText = "";
  let importError = false;
  let copied = false;

  function onMenu(id: string) {
    copied = false;
    importError = false;
    if (id === "export") {
      codeText = encodeBuild();
      modal = "export";
    } else if (id === "import") {
      codeText = "";
      modal = "import";
    } else {
      console.info(`[menu] ${id} (미구현)`);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeText);
      copied = true;
    } catch {
      copied = false;
    }
  }

  function doImport() {
    if (importBuild(codeText)) {
      modal = null;
    } else {
      importError = true;
    }
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

{#if modal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => (modal = null)}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <h3>{modal === "export" ? "빌드 내보내기" : "빌드 가져오기"}</h3>
      <p class="desc">
        {modal === "export"
          ? "아래 코드를 복사해 공유하세요. 상대는 가져오기에 붙여넣으면 됩니다."
          : "공유받은 빌드 코드를 붙여넣고 불러오기를 누르세요."}
      </p>
      <textarea bind:value={codeText} readonly={modal === "export"} spellcheck="false" placeholder="여기에 빌드 코드 붙여넣기"></textarea>
      {#if importError}<p class="err">코드를 해석할 수 없습니다. 다시 확인해주세요.</p>{/if}
      <div class="actions">
        {#if modal === "export"}
          <button class="primary" on:click={copyCode}>{copied ? "복사됨 ✓" : "복사"}</button>
        {:else}
          <button class="primary" on:click={doImport}>불러오기</button>
        {/if}
        <button on:click={() => (modal = null)}>닫기</button>
      </div>
    </div>
  </div>
{/if}

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
  .overlay {
    position: fixed;
    inset: 0;
    background: #0006;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .dialog {
    width: min(560px, 92vw);
    background: #fff;
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: 0 10px 40px #0005;
  }
  .dialog h3 {
    margin: 0 0 6px;
  }
  .desc {
    margin: 0 0 10px;
    font-size: 13px;
    color: #475569;
  }
  textarea {
    width: 100%;
    height: 120px;
    resize: vertical;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    padding: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-sizing: border-box;
    word-break: break-all;
  }
  .err {
    color: #dc2626;
    font-size: 12px;
    margin: 6px 0 0;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 12px;
  }
  .actions button {
    padding: 7px 14px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
  }
  .actions .primary {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
    font-weight: 600;
  }
</style>
