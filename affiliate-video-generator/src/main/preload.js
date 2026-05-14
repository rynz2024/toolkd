const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("api", {
  pickImage: () => ipcRenderer.invoke("pick-image"),
  saveUploadedBuffer: (name, buffer) =>
    ipcRenderer.invoke("save-uploaded-buffer", { name, buffer }),
  listMusic: () => ipcRenderer.invoke("list-music"),
  generateVideo: (payload) => ipcRenderer.invoke("generate-video", payload),
  openFolder: (folderPath) => ipcRenderer.invoke("open-folder", folderPath),
  getDefaultOutputDir: () => ipcRenderer.invoke("get-default-output-dir"),
  onProgress: (cb) => {
    const listener = (_evt, progress) => cb(progress);
    ipcRenderer.on("generate-progress", listener);
    return () => ipcRenderer.removeListener("generate-progress", listener);
  },
  // Available in Electron 32+: get filesystem path of a dropped File object.
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (_) {
      return null;
    }
  },
});
