import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { defaultPrototypePath, slugify } from "./paths";
import { autoSetupEnvironment, templateHasBundledBlueprint } from "./setup";
import { writeDevPort } from "./preview";
import { getTemplateDir } from "./templatePath";

const NPM_AUTH_GUIDE =
  "https://netapp.atlassian.net/wiki/spaces/UX/pages/699076324/GitHub+access+and+package+authentication+for+designers";

export type EditorChoice = "cursor" | "claude";

export interface ScaffoldResult {
  folderPath: string;
  slug: string;
  installStatus: "success" | "partial" | "failed";
  installMessage: string;
  installHelpUrl?: string;
  opened: boolean;
  editor: EditorChoice;
}

function copyDir(src: string, dest: string) {
  // Preserve symlinks (critical for node_modules/.bin → package bins).
  // copyFileSync dereferences them and breaks tsc/vite shims.
  fs.cpSync(src, dest, {
    recursive: true,
    verbatimSymlinks: true,
    force: true,
  });
}

function replaceInFile(filePath: string, replacements: Record<string, string>) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [from, to] of Object.entries(replacements)) {
    content = content.replaceAll(from, to);
  }
  fs.writeFileSync(filePath, content);
}

function writeCursorRules(dest: string, name: string) {
  const rulesDir = path.join(dest, ".cursor", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rulesDir, "blueprint-prototype.mdc"),
    `---
description: NetApp Blueprint prototype starter rules
globs:
alwaysApply: true
---

# ${name}

You are building a NetApp UX prototype using @netapp/blueprint@legacy.

Before writing UI:
1. Read node_modules/@netapp/blueprint/dist/agent/docs/ai-layout-guidance.md
2. Use Blueprint MCP at https://ux.netapp.com/blueprint/mcp for components and props
3. Use Blueprint tokens, icons, and components - do not invent new assets when Blueprint has one
4. Keep hash routes (e.g. #/home) so Proto Hub can deep-link reviewers to screens

When the user describes what to build, implement it immediately in blueprint-app/src using React + TypeScript.
`,
  );

  fs.writeFileSync(
    path.join(dest, "AGENTS.md"),
    `# ${name}

Blueprint is already installed. Start prompting - describe what you want to build.

Starter prompt is in CURSOR_PROMPT.md if you need it.
`,
  );
}

function setupNpmrc(appDir: string) {
  const templateNpmrc = path.join(getTemplateDir(), "blueprint-app", ".npmrc");
  const destNpmrc = path.join(appDir, ".npmrc");

  // Prefer NetApp eng registry (matches working ONTAP prototypes)
  if (fs.existsSync(templateNpmrc)) {
    fs.copyFileSync(templateNpmrc, destNpmrc);
  } else {
    fs.writeFileSync(destNpmrc, "@netapp:registry=https://npm.repo.eng.netapp.com/\n");
  }
}

function friendlyNpmError(raw: string): { message: string; helpUrl?: string } {
  if (raw.includes("E401") || raw.includes("401 Unauthorized") || raw.includes("unauthenticated")) {
    return {
      message: "npm registry authentication required to install Blueprint.",
      helpUrl: NPM_AUTH_GUIDE,
    };
  }
  if (raw.includes("ENOTFOUND") || raw.includes("ECONNREFUSED")) {
    return {
      message: "Blueprint could not install - npm registry unreachable. Check VPN/network, then run npm install in blueprint-app.",
    };
  }
  const firstLine = raw.split("\n").find((l) => l.trim())?.slice(0, 200);
  return {
    message: firstLine
      ? `Blueprint could not install: ${firstLine}`
      : "Blueprint could not install. Open the project and run npm install in blueprint-app.",
    helpUrl: NPM_AUTH_GUIDE,
  };
}

function blueprintReady(appDir: string): boolean {
  return fs.existsSync(path.join(appDir, "node_modules", "@netapp", "blueprint"));
}

/** OneDrive / copyFile can flatten .bin symlinks - restore the common ones after scaffold. */
function repairNpmBinLinks(appDir: string) {
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
      if (fs.existsSync(linkPath)) {
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink()) continue;
        fs.rmSync(linkPath);
      }
      fs.symlinkSync(target, linkPath);
    } catch {
      // Best-effort - build script also calls typescript/vite by absolute path
    }
  }
}

function installDependencies(dest: string): {
  status: ScaffoldResult["installStatus"];
  message: string;
  helpUrl?: string;
} {
  const appDir = path.join(dest, "blueprint-app");
  setupNpmrc(appDir);

  if (blueprintReady(appDir)) {
    repairNpmBinLinks(appDir);
    return {
      status: "success",
      message: "Blueprint is installed and ready - start prompting in Cursor or Claude.",
    };
  }

  try {
    execSync("npm install", { cwd: appDir, stdio: "pipe", timeout: 300000 });
    if (!blueprintReady(appDir)) {
      return {
        status: "partial",
        message: "Folder created, but Blueprint did not install. Connect to VPN and try Create again.",
        helpUrl: NPM_AUTH_GUIDE,
      };
    }
    return { status: "success", message: "Blueprint is installed and ready - start prompting in Cursor or Claude." };
  } catch (error) {
    const raw =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr?: Buffer }).stderr ?? error.message)
        : error instanceof Error
          ? error.message
          : "npm install failed";
    const friendly = friendlyNpmError(raw);
    return {
      status: "partial",
      message: friendly.message,
      helpUrl: friendly.helpUrl,
    };
  }
}

export function openInEditor(folderPath: string, editor: EditorChoice): boolean {
  try {
    if (editor === "cursor") {
      if (process.platform === "darwin") {
        execSync(`open -a Cursor "${folderPath}"`, { stdio: "pipe" });
        return true;
      }
      try {
        execSync(`cursor "${folderPath}"`, { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    }

    if (process.platform === "darwin") {
      execSync(`open -a Claude "${folderPath}"`, { stdio: "pipe" });
      return true;
    }
    try {
      execSync(`claude`, { cwd: folderPath, stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export function scaffoldPrototype(
  name: string,
  folderPath?: string,
  editor: EditorChoice = "cursor",
  localPort = 5173,
): ScaffoldResult {
  const templateDir = getTemplateDir();
  if (!fs.existsSync(templateDir) || !templateHasBundledBlueprint()) {
    throw new Error(
      "Proto Hub starter files are unavailable. Pull the latest repo (template/ must be present) or contact the UX platform team.",
    );
  }

  autoSetupEnvironment();

  const slug = slugify(name) || "prototype";
  const dest = folderPath?.trim() || defaultPrototypePath(name);

  if (fs.existsSync(dest)) {
    throw new Error(`A folder already exists at: ${dest}`);
  }

  copyDir(templateDir, dest);
  replaceInFile(path.join(dest, "package.json"), {
    '"name": "prototype-template"': `"name": "${slug}"`,
  });
  replaceInFile(path.join(dest, "blueprint-app", "index.html"), {
    "Prototype Starter": name,
  });
  replaceInFile(path.join(dest, "blueprint-app", "src", "pages", "HomePage.tsx"), {
    "Your prototype": name,
  });
  writeDevPort(dest, localPort);

  writeCursorRules(dest, name);

  try {
    execSync("git init", { cwd: dest, stdio: "pipe" });
  } catch {
    // git optional
  }

  const install = installDependencies(dest);
  const opened = openInEditor(dest, editor);

  return {
    folderPath: dest,
    slug,
    installStatus: install.status,
    installMessage: install.message,
    installHelpUrl: install.helpUrl,
    opened,
    editor,
  };
}
