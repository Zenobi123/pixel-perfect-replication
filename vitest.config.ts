// Configuration Vitest INDÉPENDANTE de vite.config.ts : la config Lovable/
// TanStack embarque des plugins (Cloudflare, tanstackStart…) inadaptés à un
// runner de tests. On reconstruit ici une config minimale et neutre.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    restoreMocks: true,
  },
});
