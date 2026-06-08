import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Vitest config for RAVEIRC frontend logic tests.
// The Svelte plugin compiles `.svelte.ts` rune modules (e.g. the store) so they
// can be exercised in tests. `@tauri-apps/api` modules are mocked per-test.
export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    conditions: ["browser"],
    alias: {
      $lib: new URL("./src/lib", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
