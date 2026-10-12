/**
 * Resolve Node/npm even when Electron/GUI apps have a thin PATH (no nvm/homebrew).
 * Can also download a portable Node into ~/ProtoHub/runtime so Create works
 * without a terminal install.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";

const NODE_VERSION = "v20.18.1";

function homeDir(): string {
  return process.env.HOME || os.homedir() || "";
}

export function runtimeNodeRoot(): string {
  return path.join(homeDir(), "ProtoHub", "runtime", `node-${NODE_VERSION}`);
}

function archSuffix(): string {
  return process.arch === "arm64" ? "arm64" : "x64";
}

function nvmNodeBins(): string[] {
  const nvmDir = path.join(homeDir(), ".nvm", "versions", "node");
  const bins: string[] = [];
  try {
    if (!fs.existsSync(nvmDir)) return bins;
    for (const v of fs.readdirSync(nvmDir).sort().reverse()) {
      bins.push(path.join(nvmDir, v, "bin"));
    }
  } catch {
    // ignore
  }
  return bins;
}

/** Directories that commonly contain node/npm on designer Macs. */
export function nodeBinCandidates(): string[] {
  const runtimeBin = path.join(runtimeNodeRoot(), "bin");
  return [
    runtimeBin,
    ...nvmNodeBins(),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    path.join(homeDir(), ".local", "bin"),
  ].filter(Boolean);
}

export function enrichedPath(): string {
  const parts = [...nodeBinCandidates(), process.env.PATH || ""].filter(Boolean);
  return [...new Set(parts.join(path.delimiter).split(path.delimiter).filter(Boolean))].join(
    path.delimiter,
  );
}

export function resolveBinary(name: "node" | "npm"): string | null {
  for (const dir of nodeBinCandidates()) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Last resort: whatever is on PATH
  const which = spawnSync("which", [name], {
    encoding: "utf-8",
    env: { ...process.env, PATH: enrichedPath() },
    timeout: 3000,
  });
  if (which.status === 0) {
    const found = (which.stdout || "").trim().split("\n")[0];
    if (found && fs.existsSync(found)) return found;
  }
  return null;
}

export function resolveNode(): string | null {
  return resolveBinary("node");
}

export function resolveNpm(): string | null {
  return resolveBinary("npm");
}

export function commandOkResolved(name: "node" | "npm", args: string[] = ["--version"]): boolean {
  const bin = resolveBinary(name);
  if (!bin) return false;
  const result = spawnSync(bin, args, {
    encoding: "utf-8",
    timeout: 8000,
    env: { ...process.env, PATH: enrichedPath() },
  });
  return result.status === 0;
}

function tryBrewInstallNode(): string | null {
  const brew =
    ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"].find((p) => fs.existsSync(p)) || null;
  if (!brew) return null;
  try {
    execFileSync(brew, ["install", "node@20"], {
      encoding: "utf-8",
      timeout: 600000,
      env: { ...process.env, PATH: enrichedPath(), NONINTERACTIVE: "1" },
    });
    if (commandOkResolved("node") && commandOkResolved("npm")) {
      return "Installed Node.js with Homebrew";
    }
  } catch {
    try {
      execFileSync(brew, ["install", "node"], {
        encoding: "utf-8",
        timeout: 600000,
        env: { ...process.env, PATH: enrichedPath(), NONINTERACTIVE: "1" },
      });
      if (commandOkResolved("node") && commandOkResolved("npm")) {
        return "Installed Node.js with Homebrew";
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Download official Node binary tarball into ~/ProtoHub/runtime (no admin password). */
function tryPortableNodeInstall(): string | null {
  if (process.platform !== "darwin") return null;
  const root = runtimeNodeRoot();
  const binNode = path.join(root, "bin", "node");
  if (fs.existsSync(binNode) && commandOkResolved("node")) {
    return null; // already usable via resolveBinary
  }

  const tarball = `node-${NODE_VERSION}-darwin-${archSuffix()}.tar.gz`;
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${tarball}`;
  const staging = path.join(homeDir(), "ProtoHub", "runtime", "_download");
  fs.mkdirSync(staging, { recursive: true });
  const archive = path.join(staging, tarball);

  try {
    execFileSync("curl", ["-fsSL", url, "-o", archive], {
      encoding: "utf-8",
      timeout: 300000,
    });
    const parent = path.dirname(root);
    fs.mkdirSync(parent, { recursive: true });
    execFileSync("tar", ["-xzf", archive, "-C", parent], {
      encoding: "utf-8",
      timeout: 120000,
    });
    const extracted = path.join(parent, `node-${NODE_VERSION}-darwin-${archSuffix()}`);
    if (fs.existsSync(extracted) && extracted !== root) {
      if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
      fs.renameSync(extracted, root);
    }
    try {
      fs.rmSync(archive, { force: true });
    } catch {
      // ignore
    }
    if (fs.existsSync(path.join(root, "bin", "node"))) {
      return `Installed Node.js ${NODE_VERSION} for Proto Hub (no terminal needed)`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Ensure node + npm are available. Prefer existing installs; otherwise auto-install.
 * Returns human-readable actions for the Create UI.
 */
export function ensureNodeRuntime(): { ok: boolean; applied: string[]; message?: string } {
  const applied: string[] = [];

  if (commandOkResolved("node") && commandOkResolved("npm")) {
    return { ok: true, applied };
  }

  const brewMsg = tryBrewInstallNode();
  if (brewMsg) applied.push(brewMsg);
  if (commandOkResolved("node") && commandOkResolved("npm")) {
    return { ok: true, applied };
  }

  const portableMsg = tryPortableNodeInstall();
  if (portableMsg) applied.push(portableMsg);
  if (commandOkResolved("node") && commandOkResolved("npm")) {
    return { ok: true, applied };
  }

  return {
    ok: false,
    applied,
    message:
      "Could not auto-install Node.js. Proto Hub will retry, or install from https://nodejs.org once.",
  };
}

export function spawnEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: enrichedPath() };
}
