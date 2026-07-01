# 아이콘 출처 / 저작권

이 폴더의 아이콘 이미지는 스타크래프트 II 게임 애셋으로, **저작권은 Blizzard Entertainment**에 있습니다.

- 주 출처: [BurnySc2/sc2-planner](https://github.com/BurnySc2/sc2-planner)
  (`src/icons/png/btn-*` — 게임 버튼 아이콘, 유닛/건물/시간 아이콘 스타일 통일)
- 일부 자원 아이콘: [MatthewMarinets/ap_sc2_icons](https://github.com/MatthewMarinets/ap_sc2_icons)

## 주의
- 개인용/비공개 도구에서는 관행적으로 문제되지 않으나, **공개 웹 서비스**(특히 수익화)
  로 배포 시 Blizzard IP 관련 **테이크다운 위험**이 있습니다.
- 공개 배포가 필요해지면 이 아이콘들을 **자체/오픈 라이선스 아이콘으로 교체**하기 쉽게,
  UI는 아이콘 없으면 텍스트로 폴백하도록 설계돼 있습니다 (src/lib/components/Icon.svelte).

## 현재 커버리지
- ✅ 테란 유닛 전부(SCV 포함) + 건물 전부(병영·보급고·군수공장·우주공항·기술실·반응로 등)
- ✅ 자원: 미네랄 / 가스 / 보급 / 시간
- ⛔ 궤도사령부(orbital_command) — 소스에 버튼 아이콘 없어 텍스트 폴백. 확보 시
  `units/orbital_command.png`로 넣으면 자동 적용.
- 프로토스/저그는 아직(M4). 필요한 id는 `units/{id}.png`로 넣으면 인식.
