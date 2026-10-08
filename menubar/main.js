/**
 * Proto Hub — menu bar + Dock so people can always find it.
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
const HUB_DIR = process.env.PROTO_HUB_DIR || path.resolve(__dirname, "..");
const URL = `http://127.0.0.1:${PORT}`;

let tray = null;
let win = null;
let serverProc = null;
let startingServer = null;

app.setName("Proto Hub");
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

async function ensureServer() {
  if (startingServer) return startingServer;

  startingServer = (async () => {
    // Always restart from this install’s Proto Hub folder
    killStaleServer();
    await new Promise((r) => setTimeout(r, 400));

    log("Starting Proto Hub server from", HUB_DIR);
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
  // Colored icon so it still reads in a crowded / overflow menu bar
  const color = path.join(__dirname, "assets", "TrayIcon.png");
  if (fs.existsSync(color)) {
    return nativeImage.createFromPath(color);
  }
  const asset = path.join(__dirname, "assets", "IconTemplate.png");
  const img = nativeImage.createFromPath(asset);
  img.setTemplateImage(true);
  return img;
}

function dockIcon() {
  const icon = path.join(__dirname, "assets", "AppIcon.png");
  if (fs.existsSync(icon)) return nativeImage.createFromPath(icon);
  return trayIcon();
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
    // Closing the window keeps the app alive in Dock + menu bar
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "Proto Hub is still running",
          body: "Click the teal icon near Wi‑Fi, or Proto Hub in the Dock, to open it again.",
        }).show();
      }
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
    const current = win.webContents.getURL();
    if (!current || !current.startsWith(URL)) {
      await win.loadURL(URL);
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (process.platform === "darwin" && app.dock) app.dock.show();
    tray?.setToolTip("Proto Hub — click to open");
  } catch (err) {
    log("Failed to open", err);
    tray?.setToolTip("Proto Hub — failed to start");
    dialog.showErrorBox(
      "Proto Hub",
      err instanceof Error ? err.message : "Could not start Proto Hub",
    );
  }
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Proto Hub — click to open");

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
    body: "Teal icon near Wi‑Fi, or Proto Hub in the Dock. Spotlight: ⌘Space → Proto Hub",
  }).show();
}

app.whenReady().then(() => {
  // Keep Dock icon so people can find/pin it when the menu bar is full
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(dockIcon());
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
  void showApp().then(notifyReady);

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
