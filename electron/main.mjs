import { app, BrowserWindow, shell } from "electron";

const START_URL =
  process.env.ELECTRON_START_URL ?? "http://127.0.0.1:3000";

/** @type {BrowserWindow | null} */
let mainWindow = null;

async function loadAppUrl(win) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await win.loadURL(START_URL);
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(
          `[electron] Failed to load ${START_URL}. Start the dev server with \`pnpm dev\` or use \`pnpm electron:dev\`.`,
        );
        console.error(err);
        app.quit();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  void loadAppUrl(mainWindow);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
