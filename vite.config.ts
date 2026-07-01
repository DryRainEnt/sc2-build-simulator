import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    // 5173은 다른 프로젝트(LAIOS)가 사용 중 → SCBS 전용 포트로 분리.
    port: 5180,
    strictPort: false, // 5180이 막혀도 다음 빈 포트로 자동 이동(콘솔에 실제 주소 출력)
  },
});
