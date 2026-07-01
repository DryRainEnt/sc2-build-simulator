// 번들된 아이콘(id → URL) 해석. 파일이 있으면 URL, 없으면 undefined → UI가 텍스트로 폴백.
//
// 아이콘 추가법: src/assets/icons/units/{유닛id}.png 로 파일을 넣으면 자동 인식.
// (Vite import.meta.glob 이 빌드시 URL로 변환)

function toIdMap(mods: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(mods)) {
    const m = path.match(/([^/]+)\.png$/);
    if (m) out[m[1]] = url;
  }
  return out;
}

const unitModules = import.meta.glob<string>("../assets/icons/units/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});
const resourceModules = import.meta.glob<string>("../assets/icons/resource/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});

export const UNIT_ICONS: Record<string, string> = toIdMap(unitModules);
export const RESOURCE_ICONS: Record<string, string> = toIdMap(resourceModules);

export function unitIconUrl(id: string | undefined): string | undefined {
  return id ? UNIT_ICONS[id] : undefined;
}

export function resourceIconUrl(kind: "minerals" | "gas" | "supply"): string | undefined {
  return RESOURCE_ICONS[kind];
}
