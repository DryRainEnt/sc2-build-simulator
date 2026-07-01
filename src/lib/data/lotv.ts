// 하위호환 재노출: 기존 코드가 참조하던 LOTV_PATCH는 이제 레지스트리 기본 패치다.
// (데이터 정의는 patches/*.json + schema.ts + registry.ts 로 이관됨.)
import { DEFAULT_PATCH } from "./registry";

export const LOTV_PATCH = DEFAULT_PATCH;
