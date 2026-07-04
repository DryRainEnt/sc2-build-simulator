<script lang="ts">
  import {
    patch,
    allPatches,
    findPatch,
    encodeBuild,
    importBuild,
    encodePatch,
    importPatchCode,
    displaySettings,
  } from "../stores/sim";
  import CustomPatchEditor from "./CustomPatchEditor.svelte";
  import { t, lang } from "../i18n";

  let selectedId: string;
  $: selectedId = $patch.id;

  function onSelect(e: Event) {
    patch.set(findPatch((e.target as HTMLSelectElement).value));
  }

  const menu = [
    { id: "new-patch", label: "커스텀 패치 작성" },
    { id: "export-patch", label: "패치 내보내기" },
    { id: "import-patch", label: "패치 가져오기" },
    { id: "export-build", label: "빌드 내보내기" },
    { id: "import-build", label: "빌드 가져오기" },
    { id: "display", label: "표시 설정" },
  ];

  // 코드 모달(내보내기/가져오기 · 빌드/패치 공용)
  let codeModal: { mode: "export" | "import"; kind: "build" | "patch" } | null = null;
  let codeText = "";
  let importError = false;
  let copied = false;
  let displayOpen = false;
  let showEditor = false;

  function onMenu(id: string) {
    copied = false;
    importError = false;
    if (id === "new-patch") showEditor = true;
    else if (id === "export-build") {
      codeText = encodeBuild();
      codeModal = { mode: "export", kind: "build" };
    } else if (id === "import-build") {
      codeText = "";
      codeModal = { mode: "import", kind: "build" };
    } else if (id === "export-patch") {
      codeText = encodePatch($patch);
      codeModal = { mode: "export", kind: "patch" };
    } else if (id === "import-patch") {
      codeText = "";
      codeModal = { mode: "import", kind: "patch" };
    } else if (id === "display") displayOpen = true;
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
    if (!codeModal) return;
    const ok = codeModal.kind === "build" ? importBuild(codeText) : importPatchCode(codeText);
    if (ok) codeModal = null;
    else importError = true;
  }

  $: modalTitle = codeModal
    ? `${$t(codeModal.kind === "build" ? "빌드" : "패치")} ${$t(codeModal.mode === "export" ? "내보내기" : "가져오기")}`
    : "";
</script>

<header class="topbar">
  <div class="patch-select">
    <label>
      <span>{$t("패치")}</span>
      <select value={selectedId} on:change={onSelect}>
        {#each $allPatches as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <nav class="menu">
    {#each menu as m}
      <button type="button" on:click={() => onMenu(m.id)}>{$t(m.label)}</button>
    {/each}
  </nav>
</header>

{#if codeModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => (codeModal = null)}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <h3>{modalTitle}</h3>
      <p class="desc">
        {codeModal.mode === "export"
          ? $t("아래 코드를 복사해 공유하세요. 상대는 가져오기에 붙여넣으면 됩니다.")
          : $t("공유받은 코드를 붙여넣고 불러오기를 누르세요.")}
      </p>
      <textarea bind:value={codeText} readonly={codeModal.mode === "export"} spellcheck="false" placeholder={$t("여기에 코드 붙여넣기")}></textarea>
      {#if importError}<p class="err">{$t("코드를 해석할 수 없습니다.")}</p>{/if}
      <div class="actions">
        {#if codeModal.mode === "export"}
          <button class="primary" on:click={copyCode}>{copied ? $t("복사됨 ✓") : $t("복사")}</button>
        {:else}
          <button class="primary" on:click={doImport}>{$t("불러오기")}</button>
        {/if}
        <button on:click={() => (codeModal = null)}>{$t("닫기")}</button>
      </div>
    </div>
  </div>
{/if}

{#if displayOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={() => (displayOpen = false)}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <h3>{$t("표시 설정")}</h3>
      <div class="settings">
        <label class="scale">
          {$t("언어")}
          <select bind:value={$lang}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </label>
        <label><input type="checkbox" bind:checked={$displaySettings.dark} /> {$t("다크 모드")}</label>
        <label class="scale">
          {$t("UI 배율")}
          <input type="range" min="70" max="150" step="5" bind:value={$displaySettings.scale} />
          <span>{$displaySettings.scale}%</span>
        </label>
        <hr />
        <label><input type="checkbox" bind:checked={$displaySettings.showIdle} /> {$t("생산 건물 유휴 하이라이트")}</label>
        <label><input type="checkbox" bind:checked={$displaySettings.showTech} /> {$t("테크 선행조건 경고 마커")}</label>
        <label><input type="checkbox" bind:checked={$displaySettings.showLarva} /> {$t("저그 애벌레 그래프")}</label>
      </div>
      <div class="actions">
        <button class="primary" on:click={() => (displayOpen = false)}>{$t("닫기")}</button>
      </div>
    </div>
  </div>
{/if}

{#if showEditor}
  <CustomPatchEditor base={$patch} on:close={() => (showEditor = false)} />
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
    flex-wrap: wrap;
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
  .settings {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 8px 0;
  }
  .settings label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }
  .settings label.scale input[type="range"] {
    flex: 1;
  }
  .settings hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2px 0;
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
