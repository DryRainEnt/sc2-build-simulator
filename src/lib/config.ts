// 전역 표시/시뮬레이션 설정.

/** 시간선 축척: 1초당 픽셀 수 (설계 문서 기준, 임시값). */
export const PX_PER_SEC = 4;

/** 기본 시뮬레이션 길이(초). */
export const DEFAULT_DURATION = 300;

/** 시간(초) → 시간선 세로 픽셀 위치. */
export function timeToPx(t: number): number {
  return t * PX_PER_SEC;
}

/** 시간선 세로 픽셀 위치 → 시간(초). */
export function pxToTime(px: number): number {
  return px / PX_PER_SEC;
}
