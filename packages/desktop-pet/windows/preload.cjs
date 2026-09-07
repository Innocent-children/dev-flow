const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pet", {
  ready: () => ipcRenderer.send("pet:ready"),
  command: (name, value) => ipcRenderer.invoke("pet:command", name, value),
  onState: (callback) =>
    ipcRenderer.on("pet:state", (_, state) => callback(state)),
  onWalkComplete: (callback) => ipcRenderer.on("pet:walk-complete", callback),
});
