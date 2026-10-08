#!/usr/bin/env node
/**
 * One-command Proto Hub for the team:
 *   npx --yes github:reachsreehitha-cloud/proto-hub
 *
 * Clones/updates ~/ProtoHub, installs deps, adds a Dock/Applications
 * launcher, starts the app, and opens it in the browser.
 */
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const REPO = "https://github.com/reachsreehitha-cloud/proto-hub.git";
const PORT = Number(process.env.PORT || 3000);
const APP_NAME = "Proto Hub";
const APPLICATIONS_DIR = path.join(os.homedir(), "Applications");
const APP_PATH = path.join(APPLICATIONS_DIR, `${APP_NAME}.app`);

/** npx downloads are ephemeral — clone to ~/ProtoHub. Local checkouts run in place. */
function getHubDir() {
  const fromSource = path.resolve(__dirname, "..");
  const isEphemeral = /[\\/](_npx|\.npm|_cacache)[\\/]/i.test(fromSource);
  if (!isEphemeral && fs.existsSync(path.join(fromSource, "src", "app"))) {
    return fromSource;
  }
  return path.join(os.homedir(), "ProtoHub");
}

const HUB_DIR = getHubDir();

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
  return spawnSync(cmd, args, {
    encoding: "utf8",
    ...opts,
  });
}

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

function ensureHubCheckout() {
  const pkg = path.join(HUB_DIR, "package.json");
  if (!fs.existsSync(pkg)) {
    log(`Installing Proto Hub into ${HUB_DIR}`);
    fs.mkdirSync(path.dirname(HUB_DIR), { recursive: true });
    if (fs.existsSync(HUB_DIR)) {
      // Empty or broken folder — remove and clone fresh
      fs.rmSync(HUB_DIR, { recursive: true, force: true });
    }
    run("git", ["clone", "--depth", "1", REPO, HUB_DIR]);
    return;
  }

  log(`Updating ${HUB_DIR}`);
  const pull = runQuiet("git", ["-C", HUB_DIR, "pull", "--ff-only"], { stdio: "inherit" });
  if (pull.status !== 0) {
    log("Could not fast-forward (local changes?). Continuing with what you have.");
  }
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
  if (fs.existsSync(marker) && !process.env.PROTO_HUB_FORCE_INSTALL) {
    log("Dependencies already installed");
    return;
  }
  log("Installing npm dependencies (first run takes a minute)…");
  run("npm", ["install"], { cwd: HUB_DIR });
}

function writeLauncherScript() {
  const macOsDir = path.join(APP_PATH, "Contents", "MacOS");
  const resourcesDir = path.join(APP_PATH, "Contents", "Resources");
  fs.mkdirSync(macOsDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });

  const launcher = path.join(macOsDir, APP_NAME);
  const script = `#!/bin/bash
set -e
HUB_DIR="${HUB_DIR}"
PORT="${PORT}"
URL="http://localhost:$PORT"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$PATH"

# Prefer nvm default if present
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

cd "$HUB_DIR"

is_up() {
  curl -fsS --max-time 1 "$URL" >/dev/null 2>&1
}

if ! is_up; then
  # Start in background; logs land in ~/Library/Logs
  mkdir -p "$HOME/Library/Logs"
  nohup npm run dev -- --port "$PORT" >"$HOME/Library/Logs/proto-hub.log" 2>&1 &
  echo $! >"$HOME/Library/Logs/proto-hub.pid"
  for i in $(seq 1 60); do
    if is_up; then break; fi
    sleep 0.5
  done
fi

open "$URL"
`;
  fs.writeFileSync(launcher, script, { mode: 0o755 });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>com.netapp.ux.proto-hub</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
`;
  fs.writeFileSync(path.join(APP_PATH, "Contents", "Info.plist"), plist);
}

function ensureMacApp() {
  if (process.platform !== "darwin") {
    log("Skipping macOS app (not on Mac)");
    return;
  }
  log(`Adding ${APP_NAME} to ~/Applications`);
  writeLauncherScript();

  // Refresh Launch Services so Spotlight/Dock see it
  try {
    execFileSync("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister", [
      "-f",
      APP_PATH,
    ]);
  } catch {
    // optional
  }

  log(`App ready at ${APP_PATH}`);
  log("Drag “Proto Hub” from ~/Applications onto your Dock once — then one click opens it");
}

function waitForServer(ms = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > ms) reject(new Error("Server did not start in time"));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function startDevServer() {
  log(`Starting Proto Hub on http://localhost:${PORT}`);
  const child = spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
    cwd: HUB_DIR,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) fail(`dev server exited with ${code}`);
  });

  return child;
}

function openBrowser() {
  const url = `http://localhost:${PORT}`;
  if (process.platform === "darwin") runQuiet("open", [url]);
  else if (process.platform === "win32") runQuiet("cmd", ["/c", "start", url]);
  else runQuiet("xdg-open", [url]);
  log(`Opened ${url}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(`Proto Hub — create, publish, and comment on Blueprint prototypes

Usage:
  npx --yes github:reachsreehitha-cloud/proto-hub
  proto-hub              # after install
  proto-hub --install    # install/update + Dock app only (do not start)
  proto-hub --open       # open the macOS app launcher

Needs: Node 20+, git, VPN/Zscaler for Publish, NetApp SSO password to publish.
Repo is private — ask to be added as a collaborator first.
`);
    return;
  }

  ensureNode();
  ensureGit();
  ensureHubCheckout();
  ensureEnv();
  ensureDeps();
  ensureMacApp();

  if (args.has("--install")) {
    log("Install complete. Run again without --install to start, or click Proto Hub in your Dock.");
    return;
  }

  if (args.has("--open") && process.platform === "darwin") {
    run("open", [APP_PATH]);
    return;
  }

  // If already running, just open
  try {
    await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", reject);
      req.setTimeout(500, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
    });
    log("Proto Hub is already running");
    openBrowser();
    return;
  } catch {
    // start fresh
  }

  startDevServer();
  try {
    await waitForServer();
    openBrowser();
    log("Create a prototype → Publish with comments on → share the ux.netapp.com link");
    log("Stop with Ctrl+C. Next time: click Proto Hub in your Dock, or run the same npm command.");
  } catch (err) {
    fail(err.message || String(err));
  }
}

main().catch((err) => fail(err.stack || String(err)));
