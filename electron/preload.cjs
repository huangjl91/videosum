const { contextBridge, ipcRenderer } = require('electron');

// 预留给未来接真实后端 / 系统能力。当前 mock 阶段渲染进程基本用不到，
// 但保留标准桥接，后续 analyzeVideo 等可在主进程实现并通过 window.oc 调用。
contextBridge.exposeInMainWorld('oc', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, cb) => ipcRenderer.on(channel, cb),
});
