import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // The `@/…` paths tsconfig maps for the app; component tests import through
  // them the same way the components themselves do.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "scripts/**/*.test.ts",
      "components/**/*.test.ts?(x)",
      "app/**/*.test.ts?(x)",
    ],
  },
});
