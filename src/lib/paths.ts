import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getDesktopPath(): string {
  const home = os.homedir();
  const candidates = [
    path.join(home, "Desktop"),
    path.join(home, "OneDrive", "Desktop"),
    path.join(home, "Library", "CloudStorage", "OneDrive-NetAppInc", "Desktop"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.join(home, "Desktop");
}

export function defaultPrototypePath(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return path.join(getDesktopPath(), slug || "prototype");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
