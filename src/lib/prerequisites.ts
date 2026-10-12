import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { getDesktopPath } from "./paths";
import { autoSetupEnvironment, templateHasBundledBlueprint } from "./setup";
import {
  commandOkResolved,
  enrichedPath,
  resolveNpm,
} from "./runtimePath";

const NPM_AUTH_GUIDE =
  "https://netapp.atlassian.net/wiki/spaces/UX/pages/699076324/GitHub+access+and+package+authentication+for+designers";
const BLUEPRINT_INSTALL_GUIDE =
  "https://netapp.atlassian.net/wiki/spaces/UX/pages/636368854";
const ENG_REGISTRY = "https://npm.repo.eng.netapp.com/";

export type PrerequisiteSeverity = "blocker" | "warning";

export interface PrerequisiteIssue {
  id: string;
  message: string;
  severity: PrerequisiteSeverity;
  helpUrl?: string;
}

export interface PrerequisiteReport {
  ok: boolean;
  issues: PrerequisiteIssue[];
  blockers: PrerequisiteIssue[];
  warnings: PrerequisiteIssue[];
  autoFixed: string[];
  blueprintBundled: boolean;
}

function checkNode(): PrerequisiteIssue | null {
  // autoSetupEnvironment already tried to install; only block if still missing
  if (commandOkResolved("node")) return null;
  return {
    id: "node",
    message:
      "Node.js could not be installed automatically. Proto Hub needs it once for Blueprint previews.",
    severity: "blocker",
    helpUrl: "https://nodejs.org/",
  };
}

function checkNpm(): PrerequisiteIssue | null {
  if (commandOkResolved("npm")) return null;
  return {
    id: "npm",
    message: "npm could not be found after setup (it comes with Node.js).",
    severity: "blocker",
    helpUrl: "https://nodejs.org/",
  };
}

function checkDesktopWritable(): PrerequisiteIssue | null {
  const desktop = getDesktopPath();
  if (!fs.existsSync(desktop)) {
    return {
      id: "desktop",
      message: "Desktop folder was not found. Pick a different save location.",
      severity: "blocker",
    };
  }
  try {
    fs.accessSync(desktop, fs.constants.W_OK);
    return null;
  } catch {
    return {
      id: "desktop",
      message: "Desktop folder is not writable. Pick a different save location.",
      severity: "blocker",
    };
  }
}

function checkNpmRegistry(): PrerequisiteIssue | null {
  const npm = resolveNpm() || "npm";
  const result = spawnSync(
    npm,
    ["view", "@netapp/blueprint", "version", `--registry=${ENG_REGISTRY}`, "--prefer-online"],
    {
      encoding: "utf-8",
      timeout: 20000,
      env: { ...process.env, PATH: enrichedPath() },
    },
  );

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status === 0) return null;

  if (output.includes("E401") || output.includes("401 Unauthorized") || output.includes("unauthenticated")) {
    return {
      id: "npm-registry-auth",
      message: "npm registry authentication is only needed if you add new packages later.",
      severity: "warning",
      helpUrl: NPM_AUTH_GUIDE,
    };
  }

  if (
    output.includes("ENOTFOUND") ||
    output.includes("ECONNREFUSED") ||
    output.includes("ETIMEDOUT") ||
    output.includes("network")
  ) {
    return {
      id: "npm-registry-network",
      message: "NetApp VPN may be required later for publishing or adding packages.",
      severity: "warning",
      helpUrl: BLUEPRINT_INSTALL_GUIDE,
    };
  }

  return null;
}

function checkEditor(editor?: "cursor" /* | "claude" */): PrerequisiteIssue | null {
  if (process.platform !== "darwin") return null;

  /*
  // RESTORE: Claude / cloud editor prerequisite
  if (editor === "claude") {
    if (!fs.existsSync("/Applications/Claude.app")) {
      return {
        id: "claude",
        message: "Claude desktop app was not found - we will still create your folder.",
        severity: "warning",
        helpUrl: "https://claude.ai/download",
      };
    }
    return null;
  }
  */

  void editor;
  if (!fs.existsSync("/Applications/Cursor.app")) {
    return {
      id: "cursor",
      message: "Cursor was not found - we will still create your folder.",
      severity: "warning",
      helpUrl: "https://cursor.com",
    };
  }

  return null;
}

export function checkPrerequisites(editor?: "cursor" /* | "claude" */): PrerequisiteReport {
  // Finds or auto-installs Node, writes npmrc, etc.
  const setup = autoSetupEnvironment();
  const blueprintBundled = templateHasBundledBlueprint();

  const checks = [
    checkNode(),
    checkNpm(),
    checkDesktopWritable(),
    blueprintBundled ? null : checkNpmRegistry(),
    checkEditor(editor),
  ].filter((issue): issue is PrerequisiteIssue => issue !== null);

  const blockers = checks.filter((issue) => issue.severity === "blocker");
  const warnings = checks.filter((issue) => issue.severity === "warning");

  return {
    ok: blockers.length === 0,
    issues: checks,
    blockers,
    warnings,
    autoFixed: setup.applied,
    blueprintBundled,
  };
}

export function firstBlockerMessage(report: PrerequisiteReport): string | null {
  return report.blockers[0]?.message ?? null;
}
