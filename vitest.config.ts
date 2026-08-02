import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@legacy/core/audit": r("./packages/core/src/audit.ts"),
      "@legacy/billing": r("./packages/billing/src/index.ts"),
      "@legacy/core": r("./packages/core/src/index.ts"),
      "@legacy/succession": r("./packages/succession/src/index.ts"),
      "@legacy/death-verification": r("./packages/death-verification/src/index.ts"),
      "@legacy/oracle": r("./packages/oracle/src/index.ts"),
      "@legacy/fraud": r("./packages/fraud/src/index.ts"),
      "@legacy/health": r("./packages/health/src/index.ts"),
      "@legacy/blockchain": r("./packages/blockchain/src/index.ts"),
      "@legacy/bitcoin": r("./packages/bitcoin/src/index.ts"),
      "@legacy/demo-data": r("./packages/demo-data/src/index.ts"),
    },
  },
});
