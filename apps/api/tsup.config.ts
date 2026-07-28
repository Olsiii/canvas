import { defineConfig } from "tsup";

// Production entrypoints: real JS under dist/, not tsx on TypeScript sources.
// Workspace packages are inlined so the image only needs node_modules for
// third-party deps (sharp / argon2 stay external — native bindings).
export default defineConfig({
  entry: {
    index: "src/index.ts",
    worker: "src/worker.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@canvas\//],
  external: ["sharp", "@node-rs/argon2"],
});
