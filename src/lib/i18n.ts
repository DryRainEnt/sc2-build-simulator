import { derived, writable } from "svelte/store";

// 경량 i18n: 한국어 원문을 키로 쓰고, 영어일 때만 사전에서 치환한다.
// $t("유닛") → 한국어면 "유닛", 영어면 "Units". 사전에 없으면 원문 그대로.

export type Lang = "ko" | "en";

function loadLang(): Lang {
  try {
    return (localStorage.getItem("scbs-lang") as Lang) || "ko";
  } catch {
    return "ko";
  }
}

export const lang = writable<Lang>(loadLang());
lang.subscribe((v) => {
  try {
    localStorage.setItem("scbs-lang", v);
    document.documentElement.lang = v;
  } catch {
    /* ignore */
  }
});

const EN: Record<string, string> = {
  // 상단바 / 메뉴
  패치: "Patch",
  "커스텀 패치 작성": "New custom patch",
  "패치 내보내기": "Export patch",
  "패치 가져오기": "Import patch",
  "빌드 내보내기": "Export build",
  "빌드 가져오기": "Import build",
  "표시 설정": "Display settings",
  빌드: "Build",
  내보내기: "Export",
  가져오기: "Import",
  "아래 코드를 복사해 공유하세요. 상대는 가져오기에 붙여넣으면 됩니다.":
    "Copy the code below to share. The other person pastes it into Import.",
  "공유받은 코드를 붙여넣고 불러오기를 누르세요.": "Paste the shared code and press Load.",
  "여기에 코드 붙여넣기": "Paste code here",
  "코드를 해석할 수 없습니다.": "Could not read the code.",
  복사: "Copy",
  "복사됨 ✓": "Copied ✓",
  불러오기: "Load",
  닫기: "Close",
  언어: "Language",
  "다크 모드": "Dark mode",
  "UI 배율": "UI scale",
  "생산 건물 유휴 하이라이트": "Idle highlight for production buildings",
  "테크 선행조건 경고 마커": "Tech prerequisite warnings",
  "저그 애벌레 그래프": "Zerg larva graph",

  // 진영 패널
  유닛: "Units",
  건물: "Buildings",
  업글: "Upgrades",
  행동: "Actions",
  테란: "Terran",
  프로토스: "Protoss",
  저그: "Zerg",
  "가스 일꾼 +1": "Gas worker +1",
  "미네랄 복귀 +1": "Mineral worker +1",
  "채취 정지": "Pause mining",
  "일꾼 사망": "Worker death",
  "퀸 인젝트": "Queen inject",
  "시간선을 클릭해 마커를 먼저 배치하세요": "Click the timeline to place a marker first",
  "현재 마커": "Current marker",
  선택: "Selected",
  "데이터 없음": "No data",
  "— 기술실/반응로 클릭해 부착": "— click Tech Lab/Reactor to attach",
  "— 애드온 부착 불가(병영/군수공장/우주공항만)": "— no add-on (Barracks/Factory/Starport only)",
  "건물 열 선택 후 클릭해 부착": "select a building column, then click to attach",

  // 커스텀 패치 편집기
  이름: "Name",
  "저장 & 적용": "Save & apply",
  취소: "Cancel",
  "채취/자원": "Harvest / resources",
  "패치당 일꾼 채취/초": "Minerals/sec per worker",
  "포화 3번째/초": "Saturated 3rd/sec",
  "가스 일꾼/초(1·2번째)": "Gas/sec (1st·2nd)",
  "가스 포화/초(3번째)": "Gas saturated/sec (3rd)",
  "미네랄 왕복량": "Minerals per trip",
  "가스 왕복량": "Gas per trip",
  "패치당 정상 일꾼": "Normal workers/patch",
  "패치당 최대 일꾼": "Max workers/patch",
  "간헐천 정상 일꾼": "Normal workers/geyser",
  "간헐천 최대 일꾼": "Max workers/geyser",
  "시작/기지": "Start / base",
  "시작 미네랄": "Starting minerals",
  "시작 가스": "Starting gas",
  "시작 일꾼": "Starting workers",
  "미네랄 패치 수": "Mineral patches",
  "간헐천 수": "Geysers",
  "애벌레/워프": "Larva / warp",
  "애벌레 생성(초)": "Larva spawn (s)",
  "기지당 애벌레": "Larva per base",
  "인젝트 애벌레": "Inject larva",
  "워프인(초)": "Warp-in (s)",
  종족: "Race",
  미네랄: "Minerals",
  가스: "Gas",
  보급: "Supply",
  보급공급: "Supply prov.",
  생산시간: "Build time",
  시작수: "Start #",
  애벌레: "Larva",
  워프쿨: "Warp CD",

  // 타임라인 툴팁
  마커: "Marker",
  "클릭=선택, 더블클릭=삭제": "click=select, double-click=delete",
  "자원 부족": "Insufficient",
  "선행 부족": "missing prereq",
  유휴: "Idle",
  "클릭: 선택(애드온 부착)": "click: select (attach add-on)",
  주문: "Order",
  생산: "Produce",
  "드래그: 블록 이동": "drag: move block",
  "더블클릭: 제거": "double-click: remove",
  완료: "Done",
  "큐 대기": "Queued",
  시작: "start",
  "정지 해제": "Resume",
  지속: "for",
  "드래그로 조절": "drag to adjust",
  "채취정지 시작": "Pause start",
  "클릭: 삭제": "click: delete",
  "클릭: 1개 제거": "click: remove one",

  // 칩 라벨 조각 (buildSummary describe)
  일꾼: "Worker",
  사망: "death",
  채취정지: "Pause",
  인젝트: "Inject",
  반응로: "Reactor",
  기: "",
};

/** 번역 함수 스토어. 사용: {$t("유닛")} */
export const t = derived(lang, ($lang) => (s: string) => ($lang === "en" ? (EN[s] ?? s) : s));
