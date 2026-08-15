// VideoSum Electron 主进程
// 把 React 前端 + 内嵌后端（Express）包成独立桌面应用。
// 生产模式：主进程内启动后端，前端由后端同源托管（http://localhost:port），
// 单端口同时提供 UI 与 /api，避免跨域与额外进程。
delete process.env.ELECTRON_RUN_AS_NODE;

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = process.env.ELECTRON_DEV === '1';
const PRELOAD = path.join(__dirname, 'preload.cjs');
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');

app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.setAppUserModelId('com.videosum.app');
app.setName('VideoSum');

let mainWin = null;
let backendPort = null;

// 单实例锁：避免重复打开多个窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

/** 生产模式：在 Electron 主进程内启动后端，返回实际监听的端口 */
async function startBackendInProcess() {
  const serverEntry = path.join(__dirname, '..', 'build-server', 'index.js');
  const mod = await import(pathToFileURL(serverEntry).href);
  const { port } = await mod.startServer(3000);
  console.log('[backend] 内嵌后端已加载（端口', port, '）');
  return port;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: 'VideoSum 自动视频总结',
    icon: ICON_PATH,
    backgroundColor: '#F7F8FC',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD,
    },
  });
  mainWin = win;

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadURL(`http://localhost:${backendPort}`);
  }

  win.on('closed', () => { mainWin = null; });
}

app.whenReady().then(async () => {
  backendPort = await startBackendInProcess();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('second-instance', () => {
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
  }
});

// 论文报告导出为 DOCX：渲染进程生成二进制后，由主进程弹保存对话框写盘
ipcMain.handle('export:docx', async (_e, { filename, buffer }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
      title: '导出论文报告（DOCX）',
      defaultPath: filename || 'report.docx',
      filters: [{ name: 'Word 文档', extensions: ['docx'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    fs.writeFileSync(filePath, data);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});
