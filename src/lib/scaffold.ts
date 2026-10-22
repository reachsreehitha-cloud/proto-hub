import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { defaultPrototypePath, slugify } from "./paths";
import { autoSetupEnvironment, templateHasBundledBlueprint } from "./setup";
import { localPreviewUrlForPort, startLocalPreview, writeDevPort } from "./preview";
import { getTemplateDir } from "./templatePath";
import { ensureNodeRuntime, resolveNpm, spawnEnv } from "./runtimePath";

const NPM_AUTH_GUIDE =
  "https://netapp.atlassian.net/wiki/spaces/UX/pages/699076324/GitHub+access+and+package+authentication+for+designers";

/** Claude/"cloud" editor disabled for now. Restore `"claude"` when re-enabling. */
export type EditorChoice = "cursor"; // | "claude"

export interface ScaffoldResult {
  folderPath: string;
  slug: string;
  installStatus: "success" | "partial" | "failed";
  installMessage: string;
  installHelpUrl?: string;
  opened: boolean;
  editor: EditorChoice;
  /** Local Vite URL Proto Hub already started. Open from Create UI, no terminal. */
  localPreviewUrl?: string;
  localPort?: number;
  previewStarted?: boolean;
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

/**
 * Blueprint 0.3.x shipped agent docs as JSON (not ai-layout-guidance.md).
 * Package docs also tell agents to use `@netapp/blueprint/prototype` for "exploration"
 *. That is what made Proto Hub one-shots look washed-out. We rewrite a local guide
 * with that section replaced by a stylesheet lock.
 */
function writeBlueprintLayoutGuide(dest: string) {
  const docsJson = path.join(
    dest,
    "blueprint-app",
    "node_modules",
    "@netapp",
    "blueprint",
    "dist",
    "agent",
    "manifests",
    "docs.json",
  );
  const outPath = path.join(dest, "BLUEPRINT_LAYOUT.md");
  const header = `# Blueprint layout for Proto Hub (one-shot)

Read this before building UI. Source: \`@netapp/blueprint\` agent \`guidelines-layout\`, with Proto Hub stylesheet rules applied.

`;

  if (!fs.existsSync(docsJson)) {
    // Template may already ship BLUEPRINT_LAYOUT.md; leave it if present.
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(docsJson, "utf-8")) as {
      docs?: Record<string, { content?: string }>;
    };
    let layout = parsed.docs?.["guidelines-layout"]?.content ?? "";
    if (!layout) return;

    const stylesheetLock = `\n## Proto Hub stylesheet lock (overrides package docs)

Proto Hub prototypes are **production-CSS fidelity**. Always keep \`import "@netapp/blueprint/css"\` in \`main.tsx\`. Never import \`@netapp/blueprint/prototype\` or set \`data-fidelity="concept"\` unless the user explicitly asks for concept fidelity by name. Still use \`BpHeader.Prototype\` for Console chrome.

`;

    layout = layout.replace(
      /\n## Exploration prototypes\n[\s\S]*?(?=\n## )/,
      stylesheetLock,
    );

    // Strip leftover "use prototype" checklist lines from bundled agent docs.
    const scrubPrototypeAdvice = (text: string) =>
      text
        .replace(/^.*@netapp\/blueprint\/prototype.*$/gm, "")
        .replace(/^.*Exploration prototypes:\s*`import "@netapp\/blueprint\/prototype"`.*$/gm, "")
        .replace(/\n{3,}/g, "\n\n");

    const extras: string[] = [];
    for (const [key, title] of [
      ["guidelines-card", "Card guidelines (from agent docs)"],
      ["guidelines-table", "Table guidelines (from agent docs)"],
      ["guidelines-domain", "Domain guidelines. ONTAP / Console (from agent docs)"],
      ["guidelines-chart", "Chart guidelines (from agent docs)"],
    ] as const) {
      const content = parsed.docs?.[key]?.content;
      if (content) {
        extras.push(`\n---\n\n# ${title}\n\n` + scrubPrototypeAdvice(content));
      }
    }

    fs.writeFileSync(outPath, header + scrubPrototypeAdvice(layout) + extras.join(""));
  } catch {
    // Keep shipped BLUEPRINT_LAYOUT.md if extraction fails
  }
}

/**
 * Figma component-configuration text ships in components.json (same copy as each
 * component's Figma usage guidelines). Agents must follow this. Not invent padding.
 */
function writeFigmaComponentConfig(dest: string) {
  const componentsJson = path.join(
    dest,
    "blueprint-app",
    "node_modules",
    "@netapp",
    "blueprint",
    "dist",
    "agent",
    "manifests",
    "components.json",
  );
  const outPath = path.join(dest, "FIGMA_COMPONENT_CONFIG.md");
  if (!fs.existsSync(componentsJson)) return;

  const keys = [
    "components-card",
    "components-card-property",
    "components-card-header",
    "components-notification",
    "components-inline-notification",
    "components-simple-filters",
    "components-table",
    "components-dropdown",
  ] as const;

  try {
    const parsed = JSON.parse(fs.readFileSync(componentsJson, "utf-8")) as {
      components?: Record<string, { name?: string; description?: string }>;
    };
    const components = parsed.components ?? {};
    const parts = [
      `# Figma component configuration (from @netapp/blueprint)

These are the **Usage guidelines** pasted from each Blueprint component’s Figma configuration
(also in \`dist/agent/manifests/components.json\`). Read the relevant section before coding that component.

## Proto Hub composition rules (enforce with the configs below)

These rules are **not** fully encoded in Blueprint CSS alone. Every Create ships helpers. **use them**:
\`blueprint-app/src/patterns/consolePatterns.tsx\` (\`PageAlert\`, \`MetricPropertyBand\`) and copy \`DetailsPage.tsx\` for list screens.

1. **Content width:** Console list / inventory pages use \`BpContentRegion width="full" center={false} padded\` so the page fills the column beside the service nav (not a narrow left strip). Keep Proto Hub \`index.css\` full-width helpers.
1b. **Service nav height:** Left \`BpServiceNav\` fills the viewport column under the header (Proto Hub \`index.css\` + shell stretch). Never let the rail stop after the last nav item.
2. **KPI metric band:** Prefer \`<MetricPropertyBand items={[…]} />\`. Equivalent: \`<BpCard padding={false} style={{ width: "100%" }}>\` + \`<BpInline space="0" wrap style={{ width: "100%" }}>\` of \`BpCardProperty\` with \`hasRightSeparator\` (omit on last). Each property needs \`style={{ flex: "1 0 0", minWidth: 149, padding: "var(--space-300) var(--space-500)" }}\`.
3. **Page-level notifications:** Prefer \`<PageAlert … />\`. Standalone Figma Notification is max-width 792px for component demos; page banners must span the content region (\`width: "100%", maxWidth: "none"\`). Keep \`actionLabel\` beside the title; no exclamation marks / “successfully”.
4. **Filters:** \`BpSimpleFilters\` + up to 4 \`BpDropdown variant="underline"\` as **direct** children. Keep Proto Hub \`index.css\` width:auto override (dropdown default is width 100%).
5. Prefer these Figma configs over the legacy Cloud Style Guide for React composition.

`,
    ];

    for (const key of keys) {
      const entry = components[key];
      if (!entry?.description) continue;
      parts.push(`---\n\n## ${entry.name ?? key}\n\n${entry.description.trim()}\n`);
    }

    fs.writeFileSync(outPath, parts.join("\n"));
  } catch {
    // optional
  }
}

function writeCursorRules(dest: string, name: string) {
  const rulesDir = path.join(dest, ".cursor", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  const blueprintRules = `# ${name}. NetApp Blueprint only (one-shot Console quality)

You are building a NetApp UX prototype with **@netapp/blueprint** (already in blueprint-app/node_modules).

## Goal
Match real Console / Blueprint screens from a **single user prompt**. Full chrome, real density, production colors. Do not ship a thin wireframe shell that needs follow-up fixes.

## Hard rules
- Use **only** Blueprint React components (\`BpButton\`, \`BpAppShell\`, \`BpHeader\`, \`BpStack\`, \`BpText\`, \`BpCard\`, \`BpTable\`, etc. From \`@netapp/blueprint\`).
- Do **not** invent custom CSS UI, shadcn, MUI, plain HTML forms, or generic Tailwind component kits.
- Do **not** replace or gut \`blueprint-app/src/layout/PrototypeShell.tsx\` unless the user explicitly asks. Only add/rename nav items and routes.
- Keep hash routes (e.g. \`#/home\`) for deep links.

## Stylesheet lock (never break this)
- \`blueprint-app/src/main.tsx\` MUST keep: \`import "@netapp/blueprint/css"\`
- NEVER switch to \`@netapp/blueprint/prototype\` or \`@netapp/blueprint/concept\`
- NEVER set \`data-fidelity="concept"\` on \`document.documentElement\`
- **Ignore** any Blueprint README / agent doc that says exploration prototypes should use \`@netapp/blueprint/prototype\`. That path enables concept fidelity and is wrong for Proto Hub.

## Console shell (keep this structure)
- \`BpPageShell\` → \`BpSkipLink\` → \`BpAppShell\` with \`header={BpHeader.Prototype}\` and \`content={BpMainRegion…}\`
- Wire \`BpMainNav\` through \`mainNavPanel\` on the header (hamburger).
- Inside main region: \`BpServiceNav\` + \`BpContentRegion width="full" center={false} padded\` so list pages fill the viewport column (matches ONTAP Console shells).
- **Service nav height:** The left rail must span the full viewport under the header. Not shrink to the number of nav items or the height of the right-hand page. Keep Proto Hub \`index.css\` main-region stretch rules and \`PrototypeShell\`'s \`alignItems: "stretch"\` / \`minHeight: calc(100vh - var(--bp-shell-header-h))\`. Do not wrap \`BpServiceNav\` in a content-sized stack.
- **No starter navigation UI:** Left \`BpServiceNav\` is enough. Do **not** add Home “Starter screen” cards, “Open Details”, “Go to inventory”, or other in-page buttons whose only job is routing. Replace \`HomePage\` with the real first screen; add routes via the service nav.
- \`productName="Console"\` unless the user names a different product.

## Page patterns (Figma component configuration. Mandatory)
- **Always** follow \`FIGMA_COMPONENT_CONFIG.md\` (extracted from each component’s Figma usage guidelines in \`components.json\`).
- Prefer ready-to-use layouts from \`BLUEPRINT_LAYOUT.md\`: \`table\`, \`table+dashboard A/B\`, overview, accordion.
- Canonical inventory recipe: copy \`blueprint-app/src/pages/DetailsPage.tsx\`. Title row → \`PageAlert\` → \`MetricPropertyBand\` → \`BpSimpleFilters\` → \`BpTable\` + \`BpSearch\`.
- **Reuse** \`blueprint-app/src/patterns/consolePatterns.tsx\` (\`PageAlert\`, \`MetricPropertyBand\`). Do not reimplement padding/width by hand.
- Prefer page stack \`space="300"\`.
- **Card padding (Figma Has padding):** default \`<BpCard>\` owns \`--space-500\` inset. Never add \`paddingX\` on inner stacks. Metric bands go through \`MetricPropertyBand\` (or equivalent styles).
- **Filters:** direct underline dropdowns only; keep \`index.css\` auto-width override (Figma \`86422:42107\`).
- **Page notifications:** use \`PageAlert\` (full content width); action beside title; no “successfully” / exclamation marks (Figma \`85534:98447\`).
- Also read \`Bp*.d.ts\` JSDoc when needed. Prefer Figma/Blueprint over legacy Cloud Style Guide.
- Figma file: https://www.figma.com/design/vNPUEtCuR4Enwhz1ZeTdQE · Storybook: https://ux.netapp.com/storybook/blueprint/

## Before writing UI (in order)
1. Read \`FIGMA_COMPONENT_CONFIG.md\` and open \`blueprint-app/src/patterns/consolePatterns.tsx\`.
2. For list/dashboard screens, start from \`DetailsPage.tsx\` structure.
3. Read \`BLUEPRINT_LAYOUT.md\` for ready layouts / domain terms.
4. Optional: Blueprint MCP https://ux.netapp.com/blueprint/mcp or \`dist/agent/manifests/\`.
5. Implement in \`blueprint-app/src\` in **one pass**. Use Proto Hub helpers, keep shell, wire routes + sample data.

When the user describes a screen, implement the full Console-quality page immediately. Do not leave placeholder cards or ask whether to use Blueprint.
`;

  fs.writeFileSync(
    path.join(rulesDir, "blueprint-prototype.mdc"),
    `---
description: NetApp Blueprint prototype starter rules
globs:
alwaysApply: true
---

${blueprintRules}
`,
  );

  // Claude Code reads CLAUDE.md; Cursor also picks up AGENTS.md
  fs.writeFileSync(path.join(dest, "CLAUDE.md"), blueprintRules);
  fs.writeFileSync(
    path.join(dest, "AGENTS.md"),
    `${blueprintRules}

Starter prompt: see CURSOR_PROMPT.md
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

/** Usable Blueprint + Vite tree (package.json without dist/ is treated as incomplete). */
function blueprintReady(appDir: string): boolean {
  return (
    fs.existsSync(path.join(appDir, "node_modules", "@netapp", "blueprint", "dist", "index.js")) &&
    fs.existsSync(path.join(appDir, "node_modules", "vite", "bin", "vite.js")) &&
    fs.existsSync(path.join(appDir, "node_modules", "vite", "dist", "node", "cli.js"))
  );
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

function runNpmInstall(appDir: string, npm: string) {
  execFileSync(npm, ["install"], {
    cwd: appDir,
    stdio: "pipe",
    timeout: 300000,
    env: spawnEnv(),
  });
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
      message: "Blueprint is installed and ready - start prompting in Cursor.",
    };
  }

  ensureNodeRuntime();
  const npm = resolveNpm();
  if (!npm) {
    return {
      status: "partial",
      message: "Folder created, but npm was not available to finish Blueprint install.",
      helpUrl: "https://nodejs.org/",
    };
  }

  try {
    // Incomplete trees (e.g. old installs missing package dist/) need a real install.
    runNpmInstall(appDir, npm);
    if (!blueprintReady(appDir)) {
      // Half-copied node_modules confuse npm — wipe and retry once.
      const nm = path.join(appDir, "node_modules");
      if (fs.existsSync(nm)) fs.rmSync(nm, { recursive: true, force: true });
      runNpmInstall(appDir, npm);
    }
    if (!blueprintReady(appDir)) {
      return {
        status: "partial",
        message: "Folder created, but Blueprint did not install. Connect to VPN and try Create again.",
        helpUrl: NPM_AUTH_GUIDE,
      };
    }
    repairNpmBinLinks(appDir);
    return { status: "success", message: "Blueprint is installed and ready - start prompting in Cursor." };
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
    // Proto Hub currently opens Cursor only. Claude/"cloud" path kept below for restore.
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

    /*
    // RESTORE: Claude / cloud editor open path
    if (editor === "claude") {
      if (process.platform === "darwin") {
        try {
          execSync(`open -a "Claude" "${folderPath}"`, { stdio: "pipe" });
          return true;
        } catch {
          try {
            execSync(`claude "${folderPath}"`, { cwd: folderPath, stdio: "pipe" });
            return true;
          } catch {
            return false;
          }
        }
      }
    }
    */

    return false;
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

  // Ensure Node is on PATH for this Create (GUI apps often miss nvm)
  ensureNodeRuntime();

  const install = installDependencies(dest);
  // After Blueprint is present, refresh the one-shot layout guide from agent manifests.
  writeBlueprintLayoutGuide(dest);
  writeFigmaComponentConfig(dest);
  const opened = openInEditor(dest, editor);
  // Start Vite so designers never need `npm run dev` in a terminal.
  let previewStarted = false;
  if (install.status === "success") {
    previewStarted = startLocalPreview(dest).started;
  }

  return {
    folderPath: dest,
    slug,
    installStatus: install.status,
    installMessage: install.message,
    installHelpUrl: install.helpUrl,
    opened,
    editor,
    localPort,
    localPreviewUrl: localPreviewUrlForPort(localPort),
    previewStarted,
  };
}
