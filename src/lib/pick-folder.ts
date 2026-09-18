import { execSync } from "node:child_process";

export function canPickFolder(): boolean {
  return process.platform === "darwin";
}

/** Opens the native macOS folder picker. Returns null if the user cancels. */
export function pickFolder(defaultPath?: string): string | null {
  if (!canPickFolder()) return null;

  let script = 'POSIX path of (choose folder with prompt "Choose where to save your prototype"';
  if (defaultPath) {
    script += ` default location alias (POSIX file ${JSON.stringify(defaultPath)})`;
  }
  script += ")";

  try {
    const result = execSync(`osascript -e ${JSON.stringify(script)}`, {
      encoding: "utf-8",
      timeout: 120_000,
    });
    return result.trim().replace(/\/$/, "");
  } catch {
    return null;
  }
}
