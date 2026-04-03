/**
 * Generates the .vercel/output directory using Vercel's Build Output API.
 * This bypasses framework detection entirely — Vercel uses the directory
 * directly without trying to guess what kind of project this is.
 *
 * Run as the last step of vercel-build.
 */
import { cp, mkdir, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".vercel", "output");
const funcDir = path.join(out, "functions", "api", "index.func");

console.log("Building .vercel/output...");

// 1. Static files — copy Vite build output
await mkdir(path.join(out, "static"), { recursive: true });
await cp(
  path.join(root, "artifacts", "playbook", "dist", "public"),
  path.join(out, "static"),
  { recursive: true },
);
console.log("✓ Static files copied");

// 2. API serverless function — copy entire api-server dist (includes pino workers)
await mkdir(funcDir, { recursive: true });
await cp(
  path.join(root, "artifacts", "api-server", "dist"),
  funcDir,
  { recursive: true },
);

// Write the thin handler that re-exports the Express app
await writeFile(
  path.join(funcDir, "handler.mjs"),
  `export { default } from "./app.mjs";\n`,
);

// Function config
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs20.x", handler: "handler.mjs", maxDuration: 30 }, null, 2),
);
console.log("✓ API function built");

// 3. Routing config
await writeFile(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/api/(.*)", dest: "/api/index" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log("✓ config.json written");
console.log("✅ .vercel/output ready");
