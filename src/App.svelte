<script lang="ts">
  import { simulate } from "./lib/engine/simulate";
  import { LOTV_PATCH } from "./lib/data/lotv";
  import type { BuildEvent } from "./lib/engine/types";

  // 임시 데모 빌드: 시작 후 일꾼 몇 기 생산해보고 자원 곡선 확인용.
  // 실제 UI(시간선/마커/탭)는 이후 작업에서 붙인다. 지금은 엔진 동작 확인용 셸.
  const demo: BuildEvent[] = [
    { time: 0, kind: "train_worker" },
    { time: 12, kind: "train_worker" },
    { time: 24, kind: "train_worker" },
  ];

  const result = simulate(demo, LOTV_PATCH, { duration: 120 });

  const samples = [0, 15, 30, 45, 60, 90, 120].map((t) => ({
    t,
    ...result.stateAt(t),
  }));
</script>

<main>
  <h1>SC2 빌드 시뮬레이터 <small>(엔진 프리뷰)</small></h1>
  <p>
    패치: <strong>{LOTV_PATCH.name}</strong> · 데모 빌드(일꾼 3기 추가 생산)의
    시점별 자원 상태입니다. 시간선/마커 UI는 다음 단계에서 붙습니다.
  </p>

  <table>
    <thead>
      <tr>
        <th>시간(s)</th>
        <th>미네랄</th>
        <th>가스</th>
        <th>보급 (사용/최대)</th>
        <th>일꾼</th>
      </tr>
    </thead>
    <tbody>
      {#each samples as s}
        <tr class:err={s.minerals < 0 || s.gas < 0}>
          <td>{s.t}</td>
          <td>{Math.floor(s.minerals)}</td>
          <td>{Math.floor(s.gas)}</td>
          <td>{s.supplyUsed} / {s.supplyCap}</td>
          <td>{s.workers}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if result.errors.length > 0}
    <p class="err-note">
      ⚠ 자원 부족 구간 {result.errors.length}개 검출됨 (첫 지점: {result
        .errors[0].time}s, {result.errors[0].resource})
    </p>
  {/if}
</main>

<style>
  main {
    max-width: 640px;
    margin: 2rem auto;
    padding: 0 1rem;
    color: #18181b;
  }
  small {
    font-weight: 400;
    color: #71717a;
    font-size: 0.6em;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 1rem;
  }
  th,
  td {
    border: 1px solid #d4d4d8;
    padding: 6px 10px;
    text-align: right;
  }
  th {
    background: #e4e4e7;
  }
  td:first-child,
  th:first-child {
    text-align: left;
  }
  tr.err td {
    background: #fee2e2;
  }
  .err-note {
    color: #b91c1c;
    font-weight: 600;
  }
</style>
