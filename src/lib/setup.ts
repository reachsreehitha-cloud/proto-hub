import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getTemplateAppDir } from "./templatePath";
import { ensureNodeRuntime } from "./runtimePath";

const ENG_REGISTRY_LINE = "@netapp:registry=https://npm.repo.eng.netapp.com/";

export interface AutoSetupResult {
  applied: string[];
  nodeReady: boolean;
  nodeMessage?: string;
}

/** True when the shipped starter includes a usable Blueprint build (not just package.json). */
export function templateHasBundledBlueprint(): boolean {
  const app = getTemplateAppDir();
  return (
    fs.existsSync(path.join(app, "node_modules", "@netapp", "blueprint", "dist", "index.js")) &&
    fs.existsSync(path.join(app, "node_modules", "vite", "bin", "vite.js")) &&
    fs.existsSync(path.join(app, "node_modules", "vite", "dist", "node", "cli.js"))
  );
}

function ensureUserNpmrc(): string | null {
  const home = os.homedir();
  if (!home) return null;

  const npmrcPath = path.join(home, ".npmrc");
  const existing = fs.existsSync(npmrcPath) ? fs.readFileSync(npmrcPath, "utf-8") : "";

  if (existing.includes("@netapp:registry=")) return null;

  const prefix = existing.trim() ? `${existing.trimEnd()}\n` : "";
  fs.writeFileSync(npmrcPath, `${prefix}${ENG_REGISTRY_LINE}\n`);
  return "Pointed npm at the NetApp registry for @netapp packages";
}

/**
 * Prep the machine for Create: find/install Node, npmrc for @netapp.
 * Blueprint itself is copied from the bundled template. No separate Blueprint install.
 */
export function autoSetupEnvironment(): AutoSetupResult {
  const applied: string[] = [];

  const node = ensureNodeRuntime();
  applied.push(...node.applied);

  const npmrcFix = ensureUserNpmrc();
  if (npmrcFix) applied.push(npmrcFix);

  return {
    applied,
    nodeReady: node.ok,
    nodeMessage: node.message,
  };
}
