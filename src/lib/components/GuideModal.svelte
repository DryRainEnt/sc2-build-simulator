<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { lang, t } from "../i18n";

  const dispatch = createEventDispatcher();

  // 가이드 본문: 언어별 전체 텍스트(섹션 제목 + 항목). t() 사전 대신 통짜로 관리.
  const GUIDE_KO = [
    {
      h: "시작하기",
      items: [
        "상단에서 패치를 고르고, 좌·우 패널에서 각 진영의 종족을 선택합니다.",
        "가운데 시간선을 클릭하면 그 시각에 마커(현재 지점)가 놓입니다.",
        "유닛/건물/업글 탭에서 아이콘을 클릭하면 마커 위치에 생산이 추가됩니다. 같은 것을 여러 번 누르면 큐로 쌓입니다.",
      ],
    },
    {
      h: "생산 편집",
      items: [
        "생산 막대를 위아래로 드래그하면 그 뒤에 이어진 큐가 함께 이동합니다.",
        "생산 막대나 애드온을 더블클릭하면 제거됩니다.",
        "‘행동’ 탭의 칩(일꾼 배치·정지·사망 등)은 클릭하면 하나씩 제거됩니다.",
      ],
    },
    {
      h: "건물 열·애드온 (테란)",
      items: [
        "각 생산 건물은 세로 열 하나를 차지합니다.",
        "열 머리(위쪽 아이콘)를 클릭해 선택한 뒤, 건물 탭의 기술실/반응로를 클릭하면 그 건물에 부착됩니다(병영·군수공장·우주공항만).",
      ],
    },
    {
      h: "일꾼·채취",
      items: [
        "‘행동’ 탭에서 가스 일꾼 +1 / 미네랄 복귀 / 채취 정지 / 일꾼 사망을 배치합니다.",
        "채취 정지 막대는 아래쪽 끝 노드를 드래그해 기간을 조절합니다.",
      ],
    },
    {
      h: "자원 확인",
      items: [
        "시간선에 커서를 올리면 그 시점의 자원·인구가 뜨고, 상단 바에 양 진영 경제 요약(일꾼·분당 채취·병력·인구)이 표시됩니다.",
        "자원이 마이너스면 빨간 오류 마커, 테크 선행조건이 부족하면 경고 마커가 나타납니다.",
      ],
    },
    {
      h: "공유·설정",
      items: [
        "빌드 내보내기/가져오기로 빌드를 코드로 주고받습니다.",
        "커스텀 패치 작성에서 모든 수치를 직접 편집해 나만의 패치를 만들 수 있습니다.",
        "표시 설정에서 다크 모드·UI 배율·시간 표기·언어를 바꿉니다.",
      ],
    },
  ];

  const GUIDE_EN = [
    {
      h: "Getting started",
      items: [
        "Pick a patch at the top, and choose each side's race in the left/right panels.",
        "Click the central timeline to drop a marker (the current point).",
        "Click an icon in the Units/Buildings/Upgrades tab to add production at the marker. Click the same one repeatedly to stack a queue.",
      ],
    },
    {
      h: "Editing production",
      items: [
        "Drag a production bar up/down to move the whole back-to-back queue with it.",
        "Double-click a production bar or add-on to remove it.",
        "Chips in the Actions tab (worker assign / pause / death) are removed one at a time on click.",
      ],
    },
    {
      h: "Building columns & add-ons (Terran)",
      items: [
        "Each production building takes one vertical column.",
        "Click a column header (top icon) to select it, then click Tech Lab/Reactor in the Buildings tab to attach it (Barracks/Factory/Starport only).",
      ],
    },
    {
      h: "Workers & mining",
      items: [
        "In the Actions tab, place Gas worker +1 / Mineral worker / Pause mining / Worker death.",
        "For a mining pause, drag the bottom end node to adjust its duration.",
      ],
    },
    {
      h: "Reading resources",
      items: [
        "Hover the timeline to see that moment's resources/supply, and the top bar shows both sides' economy summary (workers, income/min, army, supply).",
        "Red error markers appear when a resource goes negative; warning markers when tech prerequisites are missing.",
      ],
    },
    {
      h: "Sharing & settings",
      items: [
        "Export/Import a build to exchange it as a code.",
        "New custom patch lets you edit every value to make your own patch.",
        "Display settings change dark mode, UI scale, time format, and language.",
      ],
    },
  ];

  $: sections = $lang === "en" ? GUIDE_EN : GUIDE_KO;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="overlay" on:click={() => dispatch("close")}>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="guide-modal" on:click|stopPropagation>
    <header>
      <h2>{$t("사용 가이드")}</h2>
      <button class="x" on:click={() => dispatch("close")} aria-label={$t("닫기")}>✕</button>
    </header>
    <div class="body">
      {#each sections as sec}
        <section>
          <h3>{sec.h}</h3>
          <ul>
            {#each sec.items as it}<li>{it}</li>{/each}
          </ul>
        </section>
      {/each}
    </div>
    <div class="foot">
      <button class="primary" on:click={() => dispatch("close")}>{$t("닫기")}</button>
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
    z-index: 150;
  }
  .guide-modal {
    width: min(640px, 94vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 12px 48px #0006;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid #e5e7eb;
  }
  header h2 {
    margin: 0;
    font-size: 18px;
  }
  .x {
    border: none;
    background: none;
    font-size: 16px;
    cursor: pointer;
    color: #64748b;
    padding: 4px 8px;
  }
  .body {
    overflow-y: auto;
    padding: 8px 18px 4px;
  }
  section {
    margin: 12px 0;
  }
  section h3 {
    margin: 0 0 6px;
    font-size: 14px;
    color: #2563eb;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  li {
    font-size: 13px;
    line-height: 1.6;
    color: #334155;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    padding: 12px 18px;
    border-top: 1px solid #e5e7eb;
  }
  .foot .primary {
    padding: 8px 18px;
    border: none;
    border-radius: 6px;
    background: #2563eb;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
</style>
