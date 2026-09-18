#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(ROOT, "blueprint-app");
const DIST = path.join(ROOT, "dist");
const basePath = process.env.VITE_BASE_PATH ?? "./";

execSync("npm run build", {
  cwd: APP_DIR,
  stdio: "inherit",
  env: { ...process.env, VITE_BASE_PATH: basePath },
});

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(APP_DIR, "dist"), DIST, { recursive: true });
console.log("Built prototype → dist/");
