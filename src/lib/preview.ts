import fs from "node:fs";
import path from "node:path";
import type { Prototype } from "./types";

const BASE_PORT = 5173;
const MAX_PORT = 5273;

export function localPreviewUrlForPort(port: number): string {
  return `http://localhost:${port}/#/home`;
}

export function portFromLocalPreviewUrl(url?: string | null): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
    const port = parsed.port ? Number(parsed.port) : 80;
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

/** Next free port in 5173-5273 that no existing prototype uses. */
export function allocateLocalPort(prototypes: Prototype[]): number {
  const used = new Set<number>();
  for (const prototype of prototypes) {
    if (typeof prototype.localPort === "number") used.add(prototype.localPort);
    const fromUrl = portFromLocalPreviewUrl(prototype.localPreviewUrl);
    if (fromUrl) used.add(fromUrl);
  }

  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (!used.has(port)) return port;
  }

  return BASE_PORT + (prototypes.length % 100);
}

/** Pin this project's Vite dev server to a unique port so card previews don't collide. */
export function writeDevPort(folderPath: string, port: number) {
  const appDir = path.join(folderPath, "blueprint-app");
  const pkgPath = path.join(appDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      scripts?: Record<string, string>;
    };
    pkg.scripts = pkg.scripts ?? {};
    pkg.scripts.dev = `vite --port ${port} --strictPort`;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  fs.mkdirSync(appDir, { recursive: true });
  const envPath = path.join(appDir, ".env.development.local");
  fs.writeFileSync(envPath, `VITE_DEV_PORT=${port}\n`);
}

export async function isPreviewReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const target = url.split("#")[0];
    const res = await fetch(target, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/html" },
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function resolveAutoPreviewUrl(prototype: {
  status: string;
  previewUrl?: string;
  localPreviewUrl?: string;
  localPort?: number;
}): string {
  if (prototype.status === "published" && prototype.previewUrl) {
    return prototype.previewUrl;
  }
  if (prototype.localPreviewUrl) return prototype.localPreviewUrl;
  if (typeof prototype.localPort === "number") {
    return localPreviewUrlForPort(prototype.localPort);
  }
  return localPreviewUrlForPort(BASE_PORT);
}
