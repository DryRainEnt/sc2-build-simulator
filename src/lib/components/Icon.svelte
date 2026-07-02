<script lang="ts">
  // 아이콘 표시 + 폴백. src 없거나 로드 실패 시 라벨 앞 글자로 된 배지를 보여준다.
  export let src: string | undefined = undefined;
  export let label = "";
  export let size = 24;

  let failed = false;
  $: showImg = !!src && !failed;
  $: initials = label.trim().slice(0, 2) || "?";
</script>

{#if showImg}
  <img
    class="icon"
    src={src}
    alt={label}
    width={size}
    height={size}
    style="width:{size}px;height:{size}px"
    loading="lazy"
    draggable="false"
    on:error={() => (failed = true)}
  />
{:else}
  <span class="icon fallback" style="width:{size}px;height:{size}px;font-size:{Math.round(size * 0.42)}px">
    {initials}
  </span>
{/if}

<style>
  .icon {
    display: inline-block;
    object-fit: contain;
    vertical-align: middle;
    flex: none;
    user-select: none;
    -webkit-user-drag: none;
  }
  .fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: #cbd5e1;
    color: #334155;
    font-weight: 700;
    text-transform: uppercase;
  }
</style>
