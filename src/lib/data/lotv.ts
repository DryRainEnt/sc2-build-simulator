// 하위호환 재노출. 엔진/요약 테스트의 안정적 기준선(12일꼼·표준 수치)으로 5.0.14 고정.
// 앱 UI 기본 패치는 registry.DEFAULT_PATCH(정렬상 최신, 현재 5.0.16)를 쓴다.
// (데이터 정의는 patches/*.json + schema.ts + registry.ts 로 이관됨.)
import { getPatchById } from "./registry";

export const LOTV_PATCH = getPatchById("5.0.14");
