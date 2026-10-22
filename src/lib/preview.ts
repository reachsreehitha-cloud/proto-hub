import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import type { Prototype } from "./types";
import { ensureNodeRuntime, resolveNode, resolveNpm, spawnEnv } from "./runtimePath";

export function blueprintAppDir(folderPath: string): string {
  return path.join(folderPath, "blueprint-app");
}

/** True when the Desktop folder + blueprint-app still exist. */
export function prototypeFolderPresent(folderPath?: string | null): boolean {
  if (!folderPath) return false;
  const appDir = blueprintAppDir(folderPath);
  return fs.existsSync(folderPath) && fs.existsSync(path.join(appDir, "package.json"));
}

/** Package folder alone is not enough — dist/ must exist (git used to omit it). */
function blueprintDepsReady(appDir: string): boolean {
  return fs.existsSync(
    path.join(appDir, "node_modules", "@netapp", "blueprint", "dist", "index.js"),
  );
}

/**
 * OneDrive / copy often flattens node_modules/.bin symlinks into broken text files.
 * Rebuild the ones preview needs (especially vite).
 */
export function repairNpmBinLinks(appDir: string) {
  const binDir = path.join(appDir, "node_modules", ".bin");
  if (!fs.existsSync(binDir)) return;

  const links: Record<string, string> = {
    tsc: "../typescript/bin/tsc",
    tsserver: "../typescript/bin/tsserver",
    vite: "../vite/bin/vite.js",
  };

  for (const [name, target] of Object.entries(links)) {
    const linkPath = path.join(binDir, name);
    const resolved = path.join(binDir, target);
    if (!fs.existsSync(resolved)) continue;

    try {
      let ok = false;
      try {
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink() && fs.readlinkSync(linkPath) === target) {
          ok = fs.existsSync(resolved);
        }
      } catch {
        ok = false;
      }
      if (ok) continue;
      fs.rmSync(linkPath, { force: true });
      fs.symlinkSync(target, linkPath);
    } catch {
      // Best-effort
    }
  }
}

function viteEntry(appDir: string): string | null {
  const candidate = path.join(appDir, "node_modules", "vite", "bin", "vite.js");
  return fs.existsSync(candidate) ? candidate : null;
}

function readDevPort(appDir: string): number {
  try {
    const envPath = path.join(appDir, ".env.development.local");
    if (fs.existsSync(envPath)) {
      const m = fs.readFileSync(envPath, "utf8").match(/VITE_DEV_PORT=(\d+)/);
      if (m) return Number(m[1]);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")) as {
      scripts?: { dev?: string };
    };
    const portMatch = pkg.scripts?.dev?.match(/--port\s+(\d+)/);
    if (portMatch) return Number(portMatch[1]);
  } catch {
    // ignore
  }
  return 5173;
}

/** Reinstall Blueprint deps when a draft folder lost node_modules (common after cleanup). */
export function ensurePreviewDependencies(folderPath: string): { ok: boolean; reason?: string } {
  const appDir = blueprintAppDir(folderPath);
  if (!fs.existsSync(path.join(appDir, "package.json"))) {
    return { ok: false, reason: "Folder missing - this draft's Desktop folder was deleted." };
  }

  // Always repair bins - OneDrive breaks vite even when packages are present
  repairNpmBinLinks(appDir);

  if (blueprintDepsReady(appDir) && viteEntry(appDir)) return { ok: true };

  ensureNodeRuntime();
  const npm = resolveNpm();
  if (!npm) {
    return { ok: false, reason: "npm not found - open Help, or install Node once from nodejs.org." };
  }

  try {
    execFileSync(npm, ["install"], {
      cwd: appDir,
      stdio: "pipe",
      timeout: 300000,
      env: spawnEnv(),
    });
    repairNpmBinLinks(appDir);
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Could not install preview deps: ${err.message}`
          : "Could not install preview deps",
    };
  }

  if (!blueprintDepsReady(appDir) || !viteEntry(appDir)) {
    return {
      ok: false,
      reason: "Blueprint deps missing. Connect to VPN and try Open preview again.",
    };
  }
  return { ok: true };
}

/**
 * Start Vite for a prototype folder (no terminal needed).
 * Detached so Proto Hub's server is not blocked.
 * Repairs OneDrive-broken node_modules/.bin/vite first, then `npm run dev`.
 */
export function startLocalPreview(
  folderPath: string,
  port?: number,
): { started: boolean; reason?: string } {
  const appDir = blueprintAppDir(folderPath);
  if (!fs.existsSync(path.join(appDir, "package.json"))) {
    return {
      started: false,
      reason: "Folder missing - this draft's Desktop folder was deleted. Remove it from Proto Hub.",
    };
  }

  const deps = ensurePreviewDependencies(folderPath);
  if (!deps.ok) {
    return { started: false, reason: deps.reason };
  }

  ensureNodeRuntime();
  const npm = resolveNpm();
  const node = resolveNode();
  const viteJs = viteEntry(appDir);
  const devPort = port ?? readDevPort(appDir);

  // Prefer node + vite.js. Skips OneDrive-broken node_modules/.bin/vite shims
  if (node && viteJs) {
    try {
      const child = spawn(
        node,
        [viteJs, "--port", String(devPort), "--strictPort", "--host", "127.0.0.1"],
        {
          cwd: appDir,
          detached: true,
          stdio: "ignore",
          env: spawnEnv(),
        },
      );
      child.unref();
      return { started: true };
    } catch {
      // fall through to npm run dev
    }
  }

  if (npm) {
    try {
      const child = spawn(npm, ["run", "dev"], {
        cwd: appDir,
        detached: true,
        stdio: "ignore",
        env: spawnEnv(),
      });
      child.unref();
      return { started: true };
    } catch (err) {
      return {
        started: false,
        reason: err instanceof Error ? err.message : "could not start preview",
      };
    }
  }

  return { started: false, reason: "Could not find Node or Vite for preview." };
}

const BASE_PORT = 5173;
const MAX_PORT = 5273;

export function localPreviewUrlForPort(port: number): string {
  return `http://127.0.0.1:${port}/#/home`;
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
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
    scripts?: Record<string, string>;
  };
  pkg.scripts = pkg.scripts ?? {};
  pkg.scripts.dev = `vite --port ${port} --strictPort --host 127.0.0.1`;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const envPath = path.join(appDir, ".env.development.local");
  fs.writeFileSync(envPath, `VITE_DEV_PORT=${port}\n`);
}

async function fetchOk(target: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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

/** Vite may bind [::1] only. Try localhost, 127.0.0.1, and [::1]. */
export async function isPreviewReachable(url: string): Promise<boolean> {
  const bare = url.split("#")[0];
  let parsed: URL;
  try {
    parsed = new URL(bare);
  } catch {
    return fetchOk(bare);
  }

  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  // Prefer 127.0.0.1. We bind Vite there so macOS doesn’t open a blank IPv6 tab
  const candidates = [
    `http://127.0.0.1:${port}/`,
    bare,
    `http://localhost:${port}/`,
    `http://[::1]:${port}/`,
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (await fetchOk(candidate)) return true;
  }
  return false;
}

/** Poll until Vite answers so the browser does not open on “site cannot be reached”. */
export async function waitUntilPreviewReady(
  url: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 45000;
  const intervalMs = options?.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPreviewReachable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
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
