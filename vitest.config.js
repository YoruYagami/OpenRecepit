import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/api/**", "src/utils/**"],
      exclude: ["src/**/*.test.{js,jsx}"],
    },
  },
});
