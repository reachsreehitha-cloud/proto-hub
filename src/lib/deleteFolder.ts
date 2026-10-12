import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Move a prototype project folder to Trash (macOS) or delete recursively elsewhere.
 * Refuses home/Desktop roots and paths outside the user's home directory.
 */
export function movePrototypeFolderToTrash(folderPath: string): {
  ok: boolean;
  message?: string;
} {
  const trimmed = folderPath?.trim();
  if (!trimmed) {
    return { ok: false, message: "No folder path on this draft." };
  }

  let resolved: string;
  try {
    resolved = fs.existsSync(trimmed) ? fs.realpathSync(trimmed) : path.resolve(trimmed);
  } catch {
    resolved = path.resolve(trimmed);
  }

  if (!fs.existsSync(resolved)) {
    return { ok: true, message: "Folder was already gone." };
  }

  const home = path.resolve(os.homedir());
  const desktop = path.join(home, "Desktop");
  const normalized = path.resolve(resolved);

  if (normalized === home || normalized === desktop) {
    return { ok: false, message: "Refusing to delete home or Desktop root." };
  }

  if (!normalized.startsWith(home + path.sep)) {
    return { ok: false, message: "Folder is outside your home directory. Not deleted." };
  }

  const stat = fs.statSync(normalized);
  if (!stat.isDirectory()) {
    return { ok: false, message: "Path is not a folder." };
  }

  try {
    if (process.platform === "darwin") {
      // Finder Trash. Recoverable, better UX than rm -rf
      const escaped = normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      execFileSync(
        "osascript",
        ["-e", `tell application "Finder" to delete (POSIX file "${escaped}")`],
        { timeout: 30000 },
      );
    } else {
      fs.rmSync(normalized, { recursive: true, force: true });
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not move folder to Trash.",
    };
  }
}

/** Best-effort: stop Vite listening on this prototype's local port. */
export function stopPreviewOnPort(port?: number | null) {
  if (!port || !Number.isFinite(port)) return;
  if (process.platform !== "darwin" && process.platform !== "linux") return;
  try {
    execFileSync("bash", ["-lc", `lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`], {
      timeout: 5000,
    });
  } catch {
    // ignore
  }
}
