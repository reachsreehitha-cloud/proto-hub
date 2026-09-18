import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HACKATHON_ROOT = path.resolve(process.cwd(), "..");
const TEMPLATE_DIR = path.join(HACKATHON_ROOT, "template");
const TEMPLATE_APP_DIR = path.join(TEMPLATE_DIR, "blueprint-app");
const ENG_REGISTRY_LINE = "@netapp:registry=https://npm.repo.eng.netapp.com/";

export interface AutoSetupResult {
  applied: string[];
}

export function templateHasBundledBlueprint(): boolean {
  return fs.existsSync(
    path.join(TEMPLATE_APP_DIR, "node_modules", "@netapp", "blueprint", "package.json"),
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

export function autoSetupEnvironment(): AutoSetupResult {
  const applied: string[] = [];

  const npmrcFix = ensureUserNpmrc();
  if (npmrcFix) applied.push(npmrcFix);

  return { applied };
}
