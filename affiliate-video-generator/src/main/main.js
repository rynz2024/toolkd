const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { generateVideo } = require("../video/generator");

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f1020",
    title: "Affiliate Video Generator",
    icon: path.join(__dirname, "..", "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenu(null);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "..", "dist", "renderer", "index.html"),
    );
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/**
 * Get the directory that holds bundled music files. In production this is
 * extraResources/music inside the installed app; in dev it is the repo path.
 */
function getMusicDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "music");
  }
  return path.resolve(__dirname, "..", "..", "assets", "music");
}

function getFontDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "fonts");
  }
  return path.resolve(__dirname, "..", "..", "assets", "fonts");
}

/**
 * Resolve the desktop directory and return the path to "Affiliate Videos".
 * Falls back to the OS Documents folder if Desktop is unavailable.
 */
function getOutputDir() {
  let base;
  try {
    base = app.getPath("desktop");
  } catch (err) {
    base = app.getPath("documents");
  }
  const outDir = path.join(base, "Affiliate Videos");
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

ipcMain.handle("pick-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih gambar",
    properties: ["openFile"],
    filters: [{ name: "Gambar", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("save-uploaded-buffer", async (_evt, { name, buffer }) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avg-"));
  const safeName = (name || "image").replace(/[^a-z0-9._-]/gi, "_");
  const outPath = path.join(tmpDir, safeName);
  fs.writeFileSync(outPath, Buffer.from(buffer));
  return outPath;
});

ipcMain.handle("list-music", () => {
  const dir = getMusicDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".mp3"))
    .map((f) => ({ id: f, label: path.parse(f).name, file: path.join(dir, f) }));
});

ipcMain.handle(
  "generate-video",
  async (
    evt,
    {
      frontImagePath,
      backImagePath,
      modelImagePath,
      productName,
      price,
      musicId,
    },
  ) => {
    const musicDir = getMusicDir();
    const fontDir = getFontDir();
    const outputDir = getOutputDir();

    const musicPath = musicId
      ? path.join(musicDir, musicId)
      : path.join(musicDir, "track1.mp3");

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const outputFile = path.join(outputDir, `affiliate-${timestamp}.mp4`);

    const onProgress = (progress) => {
      try {
        evt.sender.send("generate-progress", progress);
      } catch (_) {
        /* ignore */
      }
    };

    try {
      await generateVideo({
        frontImagePath,
        backImagePath,
        modelImagePath,
        productName,
        price,
        musicPath,
        fontDir,
        outputFile,
        onProgress,
      });
      return { success: true, outputFile, outputDir };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  },
);

ipcMain.handle("open-folder", async (_evt, folderPath) => {
  if (!folderPath) folderPath = getOutputDir();
  await shell.openPath(folderPath);
});

ipcMain.handle("get-default-output-dir", () => getOutputDir());
