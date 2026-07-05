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

// 유닛/건물/업그레이드 공식 한국어 명칭 (id → 한글). 없으면 영문 fallback.
const KO_NAME: Record<string, string> = {
  // 테란 건물
  command_center: "사령부", orbital_command: "궤도 사령부", planetary_fortress: "행성 요새",
  supply_depot: "보급고", refinery: "정제소", barracks: "병영", engineering_bay: "공학 연구소",
  bunker: "벙커", missile_turret: "미사일 포탑", sensor_tower: "감지탑", factory: "군수공장",
  ghost_academy: "유령 사관학교", armory: "무기고", starport: "우주공항", fusion_core: "융합로",
  tech_lab: "기술실", reactor: "반응로",
  // 테란 유닛
  scv: "건설로봇", mule: "지게로봇", marine: "해병", marauder: "불곰", reaper: "사신", ghost: "유령",
  hellion: "화염차", hellbat: "화염기갑병", widow_mine: "땅거미 지뢰", siege_tank: "공성 전차",
  cyclone: "사이클론", thor: "토르", viking: "바이킹", medivac: "의료선", liberator: "해방선",
  banshee: "밴시", raven: "밤까마귀", battlecruiser: "전투순양함",
  // 프로토스 건물
  nexus: "연결체", pylon: "수정탑", assimilator: "융화소", gateway: "관문",
  cybernetics_core: "인공제어소", forge: "제련소", photon_cannon: "광자포",
  shield_battery: "보호막 충전소", twilight_council: "황혼 의회", stargate: "우주관문",
  robotics_facility: "로봇공학 시설", robotics_bay: "로봇공학 지원소",
  templar_archives: "기사단 기록보관소", dark_shrine: "암흑 성소", fleet_beacon: "함대 신호소",
  // 프로토스 유닛
  probe: "탐사정", zealot: "광전사", stalker: "추적자", sentry: "파수기", adept: "사도",
  high_templar: "고위 기사", dark_templar: "암흑 기사", archon: "집정관", immortal: "불멸자",
  colossus: "거신", disruptor: "분열기", observer: "관측선", warp_prism: "차원 분광기",
  phoenix: "불사조", void_ray: "공허 포격기", oracle: "예언자", tempest: "폭풍함",
  carrier: "우주모함", interceptor: "요격기", mothership: "모선",
  // 저그 건물
  hatchery: "부화장", lair: "번식지", hive: "군락", extractor: "추출장", spawning_pool: "산란못",
  evolution_chamber: "진화장", roach_warren: "바퀴 소굴", baneling_nest: "맹독충 둥지",
  spine_crawler: "가시 촉수", spore_crawler: "포자 촉수", hydralisk_den: "히드라리스크 굴",
  lurker_den: "가시지옥 굴", infestation_pit: "감염 구덩이", spire: "둥지탑",
  greater_spire: "거대 둥지탑", nydus_network: "땅굴망", ultralisk_cavern: "울트라리스크 동굴",
  // 저그 유닛
  drone: "일벌레", overlord: "대군주", overseer: "감시 군주", queen: "여왕", zergling: "저글링",
  baneling: "맹독충", roach: "바퀴", ravager: "궤멸충", hydralisk: "히드라리스크",
  lurker: "가시지옥", infestor: "감염충", swarm_host: "군단 숙주", ultralisk: "울트라리스크",
  mutalisk: "뮤탈리스크", corruptor: "타락귀", brood_lord: "무리 군주", viper: "살모사",
  // 테란 업그레이드 (게임 공식명)
  infantry_weapons_1: "보병 무기 1", infantry_weapons_2: "보병 무기 2", infantry_weapons_3: "보병 무기 3",
  infantry_armor_1: "보병 장갑 1", infantry_armor_2: "보병 장갑 2", infantry_armor_3: "보병 장갑 3",
  vehicle_weapons_1: "차량 무기 1", vehicle_weapons_2: "차량 무기 2", vehicle_weapons_3: "차량 무기 3",
  ship_weapons_1: "우주선 무기 1", ship_weapons_2: "우주선 무기 2", ship_weapons_3: "우주선 무기 3",
  vehicle_ship_plating_1: "차량 및 우주선 장갑 1", vehicle_ship_plating_2: "차량 및 우주선 장갑 2", vehicle_ship_plating_3: "차량 및 우주선 장갑 3",
  stimpack: "전투 자극제", combat_shield: "전투 방패", concussive_shells: "충격탄",
  infernal_pre_igniter: "지옥불 조기점화기", smart_servos: "지능형 제어 장치", drilling_claws: "천공 발톱",
  hurricane_engines: "자기장 가속기", cloaking_field: "은폐장", hyperflight_rotors: "초비행 회전날개",
  advanced_ballistics: "첨단 탄도 시스템", weapon_refit: "무기 재장비", caduceus_reactor: "카두세우스 반응로",
  personal_cloaking: "개인 은폐", hi_sec_auto_tracking: "정밀 보안 자동추적기", neosteel_armor: "신소재 강철 장갑",
  // 프로토스 업그레이드 (게임 공식명)
  ground_weapons_1: "지상 무기 1", ground_weapons_2: "지상 무기 2", ground_weapons_3: "지상 무기 3",
  ground_armor_1: "지상 장갑 1", ground_armor_2: "지상 장갑 2", ground_armor_3: "지상 장갑 3",
  shields_1: "보호막 1", shields_2: "보호막 2", shields_3: "보호막 3",
  air_weapons_1: "공중 무기 1", air_weapons_2: "공중 무기 2", air_weapons_3: "공중 무기 3",
  air_armor_1: "공중 장갑 1", air_armor_2: "공중 장갑 2", air_armor_3: "공중 장갑 3",
  warpgate: "차원 관문", charge: "돌진", blink: "점멸", resonating_glaives: "공명 파열포",
  psionic_storm: "사이오닉 폭풍", shadow_stride: "그림자 걸음", gravitic_boosters: "중력 가속",
  gravitic_drive: "중력 구동", extended_thermal_lance: "열 광선 사거리", flux_vanes: "유동성 추진기",
  anion_pulse_crystals: "음이온파 수정", tectonic_destabilizers: "구조 불안정장치",
  // 저그 업그레이드 (게임 공식명)
  melee_attacks_1: "근접 공격 1", melee_attacks_2: "근접 공격 2", melee_attacks_3: "근접 공격 3",
  missile_attacks_1: "발사 공격 1", missile_attacks_2: "발사 공격 2", missile_attacks_3: "발사 공격 3",
  ground_carapace_1: "지상 갑피 1", ground_carapace_2: "지상 갑피 2", ground_carapace_3: "지상 갑피 3",
  flyer_attacks_1: "비행체 공격 1", flyer_attacks_2: "비행체 공격 2", flyer_attacks_3: "비행체 공격 3",
  flyer_carapace_1: "비행체 갑피 1", flyer_carapace_2: "비행체 갑피 2", flyer_carapace_3: "비행체 갑피 3",
  metabolic_boost: "대사 촉진", adrenal_glands: "아드레날린 분비선", glial_reconstitution: "신경 재구성",
  tunneling_claws: "땅굴 발톱", grooved_spines: "가시 홈", muscular_augments: "근육 보강",
  centrifugal_hooks: "원심 고리", pneumatized_carapace: "기낭 갑피", burrow: "잠복",
  adaptive_talons: "적응형 발톱", seismic_spines: "진동 가시뼈", anabolic_synthesis: "합성 동화 작용",
  chitinous_plating: "키틴질 장갑", neural_parasite: "신경 기생충", pathogen_glands: "병원균 분비선",
};

/** 유닛/건물/업글 이름 로컬라이저. 사용: {$un(u.id, u.name)} */
export const un = derived(
  lang,
  ($lang) => (id: string, fallback: string) => ($lang === "ko" ? (KO_NAME[id] ?? fallback) : fallback),
);
