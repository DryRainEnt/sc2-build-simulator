<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { t } from "../i18n";

  // 하단 상태표시줄에 순환 표시할 사용 팁(한국어 원문 키 → i18n 번역).
  const TIPS = [
    "시간선을 클릭해 마커를 놓고, 유닛/건물을 클릭해 생산을 추가하세요.",
    "생산 막대를 드래그하면 이어진 생산 큐가 함께 이동합니다.",
    "생산 막대나 애드온을 더블클릭하면 제거됩니다.",
    "채취 정지는 아래쪽 끝 노드를 드래그해 기간을 조절합니다.",
    "건물 열 머리(위쪽 아이콘)를 클릭해 선택한 뒤 기술실/반응로를 붙입니다.",
    "행동 칩을 클릭하면 하나씩 제거됩니다.",
    "커서를 시간선에 올리면 상단 바에 그 시점의 경제 요약이 표시됩니다.",
    "표시 설정에서 다크 모드·UI 배율·시간 표기·언어를 바꿀 수 있어요.",
    "빌드 내보내기/가져오기로 빌드를 코드로 공유할 수 있습니다.",
    "커스텀 패치 작성에서 모든 수치를 직접 편집할 수 있습니다.",
  ];

  let idx = 0;
  let timer: ReturnType<typeof setInterval>;
  onMount(() => {
    timer = setInterval(() => (idx = (idx + 1) % TIPS.length), 7000);
  });
  onDestroy(() => clearInterval(timer));
</script>

<div class="statusbar">
  <span class="hint-icon">💡</span>
  {#key idx}
    <span class="tip" in:fade={{ duration: 350 }}>{$t(TIPS[idx])}</span>
  {/key}
</div>

<style>
  .statusbar {
    height: 26px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    font-size: 12px;
    color: #475569;
    background: #eef2f6;
    border-top: 2px solid #d4d4d8;
    overflow: hidden;
    white-space: nowrap;
  }
  .hint-icon {
    flex: none;
    font-size: 12px;
  }
  .tip {
    /* {#key} 전환 시 겹치지 않게 흐름에서 유지 */
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
