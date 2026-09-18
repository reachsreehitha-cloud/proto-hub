import fs from "node:fs";
import path from "node:path";

/** Prefer template inside proto-hub (shipped in git). Fall back to sibling Hackathon/template. */
export function getTemplateDir(): string {
  const bundled = path.join(process.cwd(), "template");
  const sibling = path.resolve(process.cwd(), "..", "template");
  if (fs.existsSync(path.join(bundled, "blueprint-app"))) return bundled;
  if (fs.existsSync(path.join(sibling, "blueprint-app"))) return sibling;
  return bundled;
}

export function getTemplateAppDir(): string {
  return path.join(getTemplateDir(), "blueprint-app");
}
