#!/usr/bin/env node
/**
 * Install Team Proto Hub as a macOS menu-bar app (next to Wi‑Fi).
 *
 *   # Team Proto Hub
 *   npx --yes github:reachsreehitha-cloud/proto-hub
 *
 *   node bin/proto-hub.js
 *   node bin/proto-hub.js --dry-run   # sandbox install (does not touch ~/ProtoHub)
 *
 * Does NOT open a browser to localhost. Click the menu-bar icon to open the app.
 */
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = "https://github.com/reachsreehitha-cloud/proto-hub.git";
const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has("--dry-run") || process.env.PROTO_HUB_DRY_RUN === "1";

/** Display name in Dock / logs. Override with PROTO_HUB_APP_NAME. */
const APP_NAME = process.env.PROTO_HUB_APP_NAME || (DRY_RUN ? "Team Proto Hub (dry-run)" : "Proto Hub");

function log(msg) {
  console.log(`\x1b[36m▸\x1b[0m ${msg}`);
}

function fail(msg) {
  console.error(`\x1b[31m✖\x1b[0m ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    encoding: "utf8",
    ...opts,
  });
  if (result.status !== 0) {
    fail(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
  }
}

function runQuiet(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

/**
 * One stable install path so the menu-bar app and Create/Publish share the same data.
 * PROTO_HUB_DIR overrides. --dry-run uses ~/ProtoHub-dry-run (never ~/ProtoHub).
 */
function getHubDir() {
  if (process.env.PROTO_HUB_DIR) return path.resolve(process.env.PROTO_HUB_DIR);
  if (DRY_RUN) return path.join(os.homedir(), "ProtoHub-dry-run");
  return path.join(os.homedir(), "ProtoHub");
}

function getApplicationsDir() {
  if (process.env.PROTO_HUB_APPLICATIONS_DIR) {
    return path.resolve(process.env.PROTO_HUB_APPLICATIONS_DIR);
  }
  if (DRY_RUN) return path.join(getHubDir(), "Applications");
  return path.join(os.homedir(), "Applications");
}

const HUB_DIR = getHubDir();
const APPLICATIONS_DIR = getApplicationsDir();
const APP_PATH = path.join(APPLICATIONS_DIR, `${APP_NAME}.app`);
const MENUBAR_DIR = path.join(HUB_DIR, "menubar");
const SOURCE_DIR = path.resolve(__dirname, "..");

function ensureNode() {
  const v = process.versions.node.split(".").map(Number);
  if (v[0] < 20) {
    fail(`Node 20+ required (you have ${process.versions.node}). Install from https://nodejs.org`);
  }
}

function ensureGit() {
  if (runQuiet("git", ["--version"]).status !== 0) {
    fail("git is required. Install Xcode Command Line Tools: xcode-select --install");
  }
}

function ensureDarwin() {
  if (process.platform !== "darwin") {
    fail("The menu-bar app is macOS-only right now.");
  }
}

function syncFromSourceTree() {
  const isEphemeral = /[\\/](_npx|\.npm|_cacache)[\\/]/i.test(SOURCE_DIR);
  if (isEphemeral || SOURCE_DIR === HUB_DIR) return false;
  if (!fs.existsSync(path.join(SOURCE_DIR, "src", "app"))) return false;

  log(`Syncing ${SOURCE_DIR} → ${HUB_DIR}`);
  // Keep local draft data; refresh app code + menubar + template
  const excludes = [
    "--exclude", "node_modules",
    "--exclude", ".next",
    "--exclude", "menubar/node_modules",
    "--exclude", "data/prototypes.json",
    "--exclude", "data/comments.json",
    "--exclude", ".env",
    "--exclude", ".git",
  ];
  const r = runQuiet(
    "rsync",
    ["-a", "--delete", ...excludes, `${SOURCE_DIR}/`, `${HUB_DIR}/`],
  );
  if (r.status !== 0) {
    // Fallback without --delete if rsync missing flags
    run("rsync", ["-a", ...excludes, `${SOURCE_DIR}/`, `${HUB_DIR}/`]);
  }
  return true;
}

function ensureHubCheckout() {
  const pkg = path.join(HUB_DIR, "package.json");
  if (!fs.existsSync(pkg)) {
    log(`Installing Proto Hub into ${HUB_DIR}`);
    if (fs.existsSync(HUB_DIR)) fs.rmSync(HUB_DIR, { recursive: true, force: true });
    run("git", ["clone", "--depth", "1", REPO, HUB_DIR]);
  } else {
    log(`Updating ${HUB_DIR}`);
    const pull = runQuiet("git", ["-C", HUB_DIR, "pull", "--ff-only"], { stdio: "inherit" });
    if (pull.status !== 0) {
      log("Could not fast-forward from GitHub. Trying local sync…");
    }
  }

  // When you run from a newer Hackathon checkout, push those files into ~/ProtoHub
  syncFromSourceTree();
  log(`Proto Hub home: ${HUB_DIR}`);
}

function ensureEnv() {
  const envPath = path.join(HUB_DIR, ".env");
  if (fs.existsSync(envPath)) return;
  const example = path.join(HUB_DIR, ".env.example");
  let body = fs.existsSync(example)
    ? fs.readFileSync(example, "utf8")
    : "NEXT_PUBLIC_APP_URL=http://localhost:3000\n";
  body = body.replace(
    /UX_COMMENTER_URL=.*/g,
    "UX_COMMENTER_URL=https://ux.netapp.com/__commenter",
  );
  if (!/UX_COMMENTER_URL=/.test(body)) {
    body += "\nUX_COMMENTER_URL=https://ux.netapp.com/__commenter\n";
  }
  fs.writeFileSync(envPath, body);
  log("Created .env (comments point at ux.netapp.com)");
}

function ensureDeps() {
  const marker = path.join(HUB_DIR, "node_modules", "next", "package.json");
  if (!fs.existsSync(marker) || process.env.PROTO_HUB_FORCE_INSTALL) {
    log("Installing Proto Hub dependencies…");
    run("npm", ["install"], { cwd: HUB_DIR });
  } else {
    log("Proto Hub dependencies ready");
  }

  const electronMarker = path.join(MENUBAR_DIR, "node_modules", "electron", "package.json");
  if (!fs.existsSync(electronMarker) || process.env.PROTO_HUB_FORCE_INSTALL) {
    log("Installing menu-bar app (Electron, first run downloads ~100MB)…");
    run("npm", ["install"], { cwd: MENUBAR_DIR });
  } else {
    log("Menu-bar app ready");
  }
}

function electronBinary() {
  const local = path.join(
    MENUBAR_DIR,
    "node_modules",
    "electron",
    "dist",
    "Electron.app",
    "Contents",
    "MacOS",
    "Electron",
  );
  if (fs.existsSync(local)) return local;
  // electron may resolve via path.txt
  const which = runQuiet("npx", ["electron", "--version"], { cwd: MENUBAR_DIR });
  if (which.status !== 0) fail("Electron failed to install");
  return path.join(
    MENUBAR_DIR,
    "node_modules",
    ".bin",
    "electron",
  );
}

function writeMacApp() {
  log(`Installing ${APP_NAME} into ~/Applications (menu bar)`);

  const electronApp = path.join(
    MENUBAR_DIR,
    "node_modules",
    "electron",
    "dist",
    "Electron.app",
  );
  if (!fs.existsSync(electronApp)) {
    fail("Electron.app missing. Try PROTO_HUB_FORCE_INSTALL=1 and run again");
  }

  const icnsSrc = path.join(MENUBAR_DIR, "assets", "AppIcon.icns");
  const pngSrc = path.join(MENUBAR_DIR, "assets", "AppIcon.png");
  if (!fs.existsSync(icnsSrc) && !fs.existsSync(pngSrc)) {
    fail("AppIcon missing under menubar/assets. Regenerate icons first");
  }

  // Real Electron.app clone (not a bash wrapper). A wrapper launches Electron.app
  // and the Dock shows Electron's default gray cursor logo instead of Proto Hub.
  fs.rmSync(APP_PATH, { recursive: true, force: true });
  run("rsync", ["-a", `${electronApp}/`, `${APP_PATH}/`]);

  const resourcesDir = path.join(APP_PATH, "Contents", "Resources");
  const macOsDir = path.join(APP_PATH, "Contents", "MacOS");

  // Bake logo into the places macOS + Electron look for Dock icons
  if (fs.existsSync(icnsSrc)) {
    fs.copyFileSync(icnsSrc, path.join(resourcesDir, "electron.icns"));
    fs.copyFileSync(icnsSrc, path.join(resourcesDir, "AppIcon.icns"));
  }
  if (fs.existsSync(pngSrc)) {
    fs.copyFileSync(pngSrc, path.join(resourcesDir, "AppIcon.png"));
  }

  // Point the bundle at our menubar app (Electron loads Resources/app)
  const appLink = path.join(resourcesDir, "app");
  try {
    fs.rmSync(appLink, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.symlinkSync(MENUBAR_DIR, appLink);

  // Env wrapper: keep Proto Hub paths, then exec the real Electron binary
  const electronBin = path.join(macOsDir, "Electron");
  const wrapper = path.join(macOsDir, APP_NAME);
  const script = `#!/bin/bash
set -e
export PROTO_HUB_DIR="${HUB_DIR}"
export PROTO_HUB_PORT="3000"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

APP_BUNDLE="$(cd "$(dirname "$0")/../.." && pwd)"
ELECTRON_BIN="$APP_BUNDLE/Contents/MacOS/Electron"

# Already running. Bring Proto Hub forward
if pgrep -f "$APP_BUNDLE/Contents/MacOS/Electron" >/dev/null 2>&1 || pgrep -f "${MENUBAR_DIR}" >/dev/null 2>&1; then
  osascript -e 'tell application "System Events" to set frontmost of first process whose name contains "Proto Hub" or name contains "Electron" to true' >/dev/null 2>&1 || true
  exit 0
fi

exec "$ELECTRON_BIN" "$@"
`;
  fs.writeFileSync(wrapper, script, { mode: 0o755 });
  // Keep Electron binary executable
  try {
    fs.chmodSync(electronBin, 0o755);
  } catch {
    // ignore
  }

  const plistPath = path.join(APP_PATH, "Contents", "Info.plist");
  // Patch identity + icon on the cloned Electron plist (keeps required Electron keys)
  try {
    execFileSync("/usr/bin/plutil", ["-replace", "CFBundleName", "-string", APP_NAME, plistPath]);
    execFileSync("/usr/bin/plutil", ["-replace", "CFBundleDisplayName", "-string", APP_NAME, plistPath]);
    execFileSync(
      "/usr/bin/plutil",
      [
        "-replace",
        "CFBundleIdentifier",
        "-string",
        DRY_RUN ? "com.netapp.ux.proto-hub.dry-run" : "com.netapp.ux.proto-hub",
        plistPath,
      ],
    );
    execFileSync("/usr/bin/plutil", ["-replace", "CFBundleIconFile", "-string", "electron.icns", plistPath]);
    execFileSync("/usr/bin/plutil", ["-replace", "CFBundleExecutable", "-string", APP_NAME, plistPath]);
    execFileSync("/usr/bin/plutil", ["-replace", "CFBundleShortVersionString", "-string", "0.1.0", plistPath]);
  } catch (err) {
    fail(`Could not patch Proto Hub Info.plist: ${err instanceof Error ? err.message : err}`);
  }

  // Drop Finder icon cache for this bundle
  try {
    fs.utimesSync(APP_PATH, new Date(), new Date());
  } catch {
    // ignore
  }

  try {
    execFileSync(
      "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
      ["-f", APP_PATH],
    );
  } catch {
    // optional
  }

  // Pin to Dock so a crowded menu bar is never the only way to find it
  pinToDock();
}

function pinToDock() {
  if (DRY_RUN) {
    log("Dry-run: skipping Dock pin (your real Proto Hub Dock icon is untouched)");
    return;
  }
  if (runQuiet("which", ["dockutil"]).status === 0) {
    runQuiet("dockutil", ["--add", APP_PATH, "--label", APP_NAME, "--replacing", APP_NAME]);
    log("Pinned Proto Hub to your Dock");
    return;
  }

  const check = runQuiet("defaults", ["read", "com.apple.dock", "persistent-apps"]);
  if (check.status === 0 && check.stdout && /Proto Hub|com\.netapp\.ux\.proto-hub/i.test(check.stdout)) {
    log("Proto Hub already in Dock");
    return;
  }
  const tile = `<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>file://${APP_PATH}/</string><key>_CFURLStringType</key><integer>15</integer></dict><key>file-label</key><string>Proto Hub</string></dict></dict>`;
  runQuiet("defaults", ["write", "com.apple.dock", "persistent-apps", "-array-add", tile]);
  runQuiet("killall", ["Dock"]);
  log("Pinned Proto Hub to your Dock (Spotlight: ⌘Space → Proto Hub)");
}

function addLoginItem() {
  if (DRY_RUN) {
    log("Dry-run: skipping Login Items (your real login items are untouched)");
    return;
  }
  // Open at login so it stays in the menu bar after reboot
  const script = `
tell application "System Events"
  set appPath to POSIX file "${APP_PATH}"
  set existing to (name of every login item)
  if existing does not contain "${APP_NAME}" then
    make new login item at end of login items with properties {path:appPath, hidden:false, name:"${APP_NAME}"}
  end if
end tell
`;
  const r = runQuiet("osascript", ["-e", script]);
  if (r.status === 0) {
    log("Set to open at login (stays in the menu bar)");
  } else {
    log("Could not add login item automatically - open System Settings → General → Login Items if you want it at boot");
  }
}

function launchApp() {
  // Quit any prior Proto Hub / Electron shell so two apps don’t fight over :3000
  // (that race shows up as ERR_ABORTED loading http://127.0.0.1:3000/).
  runQuiet("pkill", ["-f", "Proto Hub.app/Contents/MacOS/Electron"]);
  runQuiet("pkill", ["-f", "Proto Hub.app/Contents/MacOS/Proto Hub"]);
  runQuiet("pkill", ["-f", "electron.*menubar/main.js"]);
  runQuiet("bash", ["-lc", `lsof -ti tcp:${process.env.PROTO_HUB_PORT || 3000} | xargs kill -9 2>/dev/null || true`]);

  log(`Launching ${APP_NAME}…`);
  run("open", [APP_PATH]);
  log("");
  if (DRY_RUN) {
    log("Dry-run sandbox app opened. Real Proto Hub is unchanged.");
    log(`  App: ${APP_PATH}`);
    log(`  Data: ${HUB_DIR}`);
  } else {
    log("How to find it (even if the menu bar is full):");
    log("  1. Dock - Proto Hub icon (pinned on install)");
    log("  2. Menu bar - Proto Hub mark near Wi-Fi (may hide in » overflow)");
    log("  3. Spotlight - press ⌘Space, type Proto Hub, Enter");
    log("  4. Finder → Applications → Proto Hub");
    log("");
    log("A window should open now. Closing it keeps Proto Hub running.");
  }
}

async function main() {
  if (ARGS.has("--help") || ARGS.has("-h")) {
    console.log(`Team Proto Hub - menu bar app for Blueprint prototypes + live comments

Usage:
  # Team Proto Hub (what to send teammates)
  npx --yes github:reachsreehitha-cloud/proto-hub

  node bin/proto-hub.js
  node bin/proto-hub.js --install   # install only, do not launch
  node bin/proto-hub.js --dry-run   # sandbox under ~/ProtoHub-dry-run (safe on your Mac)

Needs: macOS, Node 20+, git, GitHub access to this private repo.
`);
    return;
  }

  if (DRY_RUN) {
    log("Team Proto Hub dry-run (fresh-Mac simulation)");
    log(`Sandbox hub:  ${HUB_DIR}`);
    log(`Sandbox app:  ${APP_PATH}`);
    log("Your real ~/ProtoHub and ~/Applications/Proto Hub.app are NOT touched.");
  } else {
    log("Team Proto Hub install");
  }

  ensureDarwin();
  ensureNode();
  ensureGit();
  fs.mkdirSync(APPLICATIONS_DIR, { recursive: true });
  ensureHubCheckout();
  ensureEnv();
  ensureDeps();
  writeMacApp();
  addLoginItem();

  if (ARGS.has("--install") || ARGS.has("--no-launch")) {
    log("Install complete. Run again without --install, or open the app from Applications.");
    if (DRY_RUN) {
      log(`Dry-run app: open "${APP_PATH}"`);
      log("Cleanup later: rm -rf ~/ProtoHub-dry-run");
    }
    return;
  }

  if (DRY_RUN) {
    log("Dry-run: launching sandbox app only (real Proto Hub keeps running if open).");
  }
  launchApp();
  if (DRY_RUN) {
    log("Cleanup when done: rm -rf ~/ProtoHub-dry-run");
  }
}

main().catch((err) => fail(err.stack || String(err)));
