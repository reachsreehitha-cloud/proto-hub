/**
 * Proto Hub. Menu bar + Dock so people can always find it.
 * Crowded menu bars hide icons; Dock + Spotlight + notification cover that.
 */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  Notification,
  dialog,
} = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PROTO_HUB_PORT || 3000);
// Resolve through the Resources/app symlink so HUB_DIR is always ~/ProtoHub,
// not …/Proto Hub.app/Contents/Resources.
const MENUBAR_DIR = (() => {
  try {
    return fs.realpathSync(__dirname);
  } catch {
    return __dirname;
  }
})();
const HUB_DIR = process.env.PROTO_HUB_DIR || path.resolve(MENUBAR_DIR, "..");
const URL = `http://127.0.0.1:${PORT}`;

let tray = null;
let win = null;
let serverProc = null;
let startingServer = null;
let showingApp = null;
let loadRetryTimer = null;
let loadFailCount = 0;

app.setName("Proto Hub");
// Prevent macOS/Electron from thinking the window is occluded (kills mouse clicks)
app.commandLine.appendSwitch(
  "disable-features",
  "CalculateNativeWinOcclusion,MacWebContentsOcclusion",
);
if (process.platform === "darwin") {
  app.setAboutPanelOptions({
    applicationName: "Proto Hub",
    applicationVersion: "0.1.0",
  });
}

function log(...args) {
  console.log("[proto-hub]", ...args);
}

function isServerUp() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(ms = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await isServerUp()) return resolve();
      if (Date.now() - start > ms) return reject(new Error("Proto Hub took too long to start"));
      setTimeout(tick, 400);
    };
    tick();
  });
}

function resolveNpm() {
  const home = process.env.HOME || "";
  const candidates = [
    "/opt/homebrew/bin/npm",
    "/usr/local/bin/npm",
  ];

  try {
    const nvmDir = path.join(home, ".nvm", "versions", "node");
    if (fs.existsSync(nvmDir)) {
      const versions = fs.readdirSync(nvmDir).sort().reverse();
      for (const v of versions) {
        const p = path.join(nvmDir, v, "bin", "npm");
        if (fs.existsSync(p)) candidates.unshift(p);
      }
    }
  } catch {
    // ignore
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "npm";
}

function killStaleServer() {
  // Never attach to a leftover next on :3000 from an old ~/ProtoHub or other clone
  try {
    spawnSync("bash", ["-lc", `lsof -ti tcp:${PORT} | xargs kill -9 2>/dev/null || true`], {
      stdio: "ignore",
    });
  } catch {
    // ignore
  }
}

function hasProductionBuild() {
  return fs.existsSync(path.join(HUB_DIR, ".next", "BUILD_ID"));
}

function runNpm(args) {
  const npm = resolveNpm();
  const result = spawnSync(npm, args, {
    cwd: HUB_DIR,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${npm} ${args.join(" ")} failed:\n${(result.stderr || result.stdout || "").slice(0, 800)}`,
    );
  }
}

async function ensureServer() {
  if (await isServerUp()) return;
  if (startingServer) return startingServer;

  startingServer = (async () => {
    killStaleServer();
    await new Promise((r) => setTimeout(r, 500));

    const npm = resolveNpm();
    const logPath = path.join(process.env.HOME || "/tmp", "Library", "Logs", "proto-hub.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const out = fs.openSync(logPath, "a");

    // Prefer production server. Turbopack `next dev` often freezes clicks inside Electron.
    // Bind 127.0.0.1 so Electron and health checks hit the same address.
    let args = ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(PORT)];
    let env = { ...process.env, PORT: String(PORT), NODE_ENV: "production" };
    try {
      if (!hasProductionBuild()) {
        log("Building Proto Hub (one-time, ~1-2 min)…");
        runNpm(["run", "build"]);
      }
    } catch (err) {
      log("Production build failed, falling back to webpack next:", err instanceof Error ? err.message : err);
      args = ["run", "dev", "--", "--webpack", "--hostname", "127.0.0.1", "--port", String(PORT)];
      env = { ...process.env, PORT: String(PORT) };
    }

    log("Starting Proto Hub server from", HUB_DIR, args.join(" "));
    serverProc = spawn(npm, args, {
      cwd: HUB_DIR,
      env,
      stdio: ["ignore", out, out],
      detached: false,
    });
    serverProc.on("exit", (code) => {
      log("server exited", code);
      serverProc = null;
    });
    await waitForServer();
    log("Server ready");
  })().finally(() => {
    startingServer = null;
  });

  return startingServer;
}

function trayIcon() {
  // Template glyph matches Wi‑Fi / Control Center (system-tinted, correct optical size).
  // Prefer @2x then let Electron scale; fall back to colored mark if templates missing.
  const retina = path.join(MENUBAR_DIR, "assets", "IconTemplate@2x.png");
  const asset = path.join(MENUBAR_DIR, "assets", "IconTemplate.png");
  const color2x = path.join(MENUBAR_DIR, "assets", "TrayIcon@2x.png");
  const color = path.join(MENUBAR_DIR, "assets", "TrayIcon.png");

  let img = null;
  if (fs.existsSync(retina)) {
    img = nativeImage.createFromPath(retina);
    img.setTemplateImage(true);
  } else if (fs.existsSync(asset)) {
    img = nativeImage.createFromPath(asset);
    img.setTemplateImage(true);
  } else if (fs.existsSync(color2x)) {
    img = nativeImage.createFromPath(color2x);
  } else if (fs.existsSync(color)) {
    img = nativeImage.createFromPath(color);
  }

  if (!img || img.isEmpty()) return nativeImage.createEmpty();
  // Hard-cap menu-bar size so a dense PNG never looks larger than peers
  const size = img.getSize();
  if (size.width > 44 || size.height > 44) {
    return img.resize({ width: 22, height: 22, quality: "best" });
  }
  return img;
}

function dockIcon() {
  // Prefer PNG. NativeImage + .icns is flaky; empty images leave Electron's default cursor logo.
  const candidates = [
    path.join(MENUBAR_DIR, "assets", "AppIcon.png"),
    path.join(MENUBAR_DIR, "assets", "AppIcon.icns"),
    path.join(process.resourcesPath || "", "AppIcon.png"),
    path.join(process.resourcesPath || "", "electron.icns"),
  ];
  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue;
    const img = nativeImage.createFromPath(file);
    if (!img.isEmpty()) {
      // Dock likes ~128-512; oversized masters are fine
      return img;
    }
  }
  return trayIcon();
}

function applyDockIcon() {
  if (process.platform !== "darwin" || !app.dock) return;
  const icon = dockIcon();
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

function createWindow() {
  const icon = dockIcon();
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Proto Hub",
    show: false,
    icon: icon.isEmpty() ? undefined : icon,
    // Default title bar. HiddenInset overlays have broken click hit-testing in Electron
    backgroundColor: "#0a0a0b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2) log("renderer:", message);
  });
  // ERR_ABORTED (-3) is common when the Next server was killed mid-reload (rebuild).
  // Retry quietly instead of leaving a blank window / scary Chromium dialog.
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    log("did-fail-load", code, desc, url, "main=", isMainFrame);
    if (!isMainFrame) return;
    loadFailCount += 1;
    if (loadFailCount > 8) {
      tray?.setToolTip("Proto Hub. Failed to start");
      return;
    }
    if (loadRetryTimer) clearTimeout(loadRetryTimer);
    loadRetryTimer = setTimeout(() => {
      void showApp({ forceReload: true, fromFail: true });
    }, 700);
  });
  win.webContents.on("did-finish-load", () => {
    loadFailCount = 0;
  });
  win.setIgnoreMouseEvents(false);

  win.on("close", (e) => {
    // Closing the window keeps the app alive in Dock + menu bar
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "Proto Hub is still running",
          body: "Click the Proto Hub icon near Wi‑Fi, or Proto Hub in the Dock, to open it again.",
        }).show();
      }
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function showApp(options = {}) {
  // Serialize opens so Dock + tray + activate don't race-kill :3000 mid-load.
  if (showingApp) return showingApp;

  showingApp = (async () => {
    const { forceReload = false, fromFail = false } = options;
    try {
      tray?.setToolTip("Proto Hub. Starting…");
      await ensureServer();
      // Confirm the hub actually answers before navigating (avoids ERR_ABORTED).
      for (let i = 0; i < 15; i++) {
        if (await isServerUp()) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!(await isServerUp())) {
        throw new Error("Proto Hub server did not become ready on http://127.0.0.1:3000");
      }

      if (!win || win.isDestroyed()) createWindow();

      const alreadyThere =
        !forceReload &&
        !fromFail &&
        win.webContents.getURL().startsWith(URL) &&
        !win.webContents.isLoading();

      if (!alreadyThere) {
        await win.loadURL(URL);
      }

      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (process.platform === "darwin" && app.dock) app.dock.show();
      tray?.setToolTip("Proto Hub. Click to open");
    } catch (err) {
      log("Failed to open", err);
      tray?.setToolTip("Proto Hub. Failed to start");
      // Don't stack dialogs on automatic fail-load retries
      if (!fromFail) {
        dialog.showErrorBox(
          "Proto Hub",
          err instanceof Error
            ? err.message
            : "Could not start Proto Hub. Quit from the menu bar and open Proto Hub again.",
        );
      }
    }
  })().finally(() => {
    showingApp = null;
  });

  return showingApp;
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Proto Hub. Click to open");

  const menu = Menu.buildFromTemplate([
    {
      label: "Open Proto Hub",
      accelerator: "CommandOrControl+Shift+P",
      click: () => {
        void showApp();
      },
    },
    {
      label: "Show in Finder",
      click: () => {
        const appPath = path.join(process.env.HOME || "", "Applications", "Proto Hub.app");
        if (fs.existsSync(appPath)) shell.showItemInFolder(appPath);
        else shell.openPath(HUB_DIR);
      },
    },
    { type: "separator" },
    {
      label: "Quit Proto Hub",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    void showApp();
  });
  tray.on("double-click", () => {
    void showApp();
  });
}

function notifyReady() {
  if (!Notification.isSupported()) return;
  new Notification({
    title: "Proto Hub is ready",
    body: "Proto Hub icon near Wi‑Fi, or Proto Hub in the Dock. Spotlight: ⌘Space → Proto Hub",
  }).show();
}

app.whenReady().then(() => {
  // Keep Dock icon so people can find/pin it when the menu bar is full
  if (process.platform === "darwin" && app.dock) {
    applyDockIcon();
    // Re-apply after a beat. MacOS sometimes resets to Electron default on first paint
    setTimeout(applyDockIcon, 300);
    setTimeout(applyDockIcon, 1500);
    app.dock.setMenu(
      Menu.buildFromTemplate([
        {
          label: "Open Proto Hub",
          click: () => {
            void showApp();
          },
        },
        {
          label: "Quit",
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
  }

  createWindow();
  createTray();

  // Always open the window on launch so installers know it worked
  void showApp().then(() => {
    applyDockIcon();
    notifyReady();
  });

  app.on("activate", () => {
    // Clicking Dock icon on macOS
    void showApp();
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProc && !serverProc.killed) {
    try {
      serverProc.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});
