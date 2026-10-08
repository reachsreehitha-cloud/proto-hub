/**
 * Proto Hub — lives in the macOS menu bar (next to Wi‑Fi).
 * Click the icon to open the app window. No browser. No localhost in the UI.
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PROTO_HUB_PORT || 3000);
const HUB_DIR = process.env.PROTO_HUB_DIR || path.resolve(__dirname, "..");
const URL = `http://127.0.0.1:${PORT}`;

let tray = null;
let win = null;
let serverProc = null;
let startingServer = null;

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
    process.env.npm_execpath && process.execPath,
    "/opt/homebrew/bin/npm",
    "/usr/local/bin/npm",
  ].filter(Boolean);

  // nvm
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
    if (typeof c === "string" && fs.existsSync(c)) return c;
  }
  return "npm";
}

async function ensureServer() {
  if (await isServerUp()) return;
  if (startingServer) return startingServer;

  startingServer = (async () => {
    log("Starting Proto Hub server…");
    const npm = resolveNpm();
    const env = { ...process.env, PORT: String(PORT) };
    serverProc = spawn(npm, ["run", "dev", "--", "--port", String(PORT)], {
      cwd: HUB_DIR,
      env,
      stdio: "ignore",
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
  const asset = path.join(__dirname, "assets", "IconTemplate.png");
  const img = nativeImage.createFromPath(asset);
  img.setTemplateImage(true);
  return img;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Proto Hub",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0a0a0b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.on("close", (e) => {
    // Hide to menu bar instead of quitting — app keeps living next to Wi‑Fi
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function showApp() {
  try {
    tray?.setToolTip("Proto Hub — starting…");
    await ensureServer();
    if (!win) createWindow();
    if (win.webContents.getURL() !== URL && !win.webContents.getURL().startsWith(URL)) {
      await win.loadURL(URL);
    }
    win.show();
    win.focus();
    tray?.setToolTip("Proto Hub");
  } catch (err) {
    log("Failed to open", err);
    tray?.setToolTip("Proto Hub — failed to start (see logs)");
    const { dialog } = require("electron");
    dialog.showErrorBox(
      "Proto Hub",
      err instanceof Error ? err.message : "Could not start Proto Hub",
    );
  }
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Proto Hub");

  const menu = Menu.buildFromTemplate([
    {
      label: "Open Proto Hub",
      click: () => {
        void showApp();
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

  // Left-click opens the app window
  tray.on("click", () => {
    void showApp();
  });
}

app.whenReady().then(() => {
  // Stay in the menu bar only — not in the Dock
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }
  createWindow();
  createTray();
  // Warm the server in the background so first click is fast
  void ensureServer().catch((err) => log("warm start failed", err));
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
  // Keep running in the menu bar
  e.preventDefault();
});
