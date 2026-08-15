import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

function getDataDir(): string {
  // 仅在 Electron 运行时（主进程）使用 userData；普通 Node 下用 cwd/data。
  // 注意：不能用 try{require('electron')} 探测，因为普通 Node 里 require('electron')
  // 会触发 Electron 二进制下载/启动，导致阻塞。
  if (process.versions.electron) {
    try {
      const require = createRequire(import.meta.url);
      const electron = require('electron');
      return electron.app.getPath('userData');
    } catch {
      /* ignore */
    }
  }
  return path.resolve(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();
const DB_FILE = path.join(DATA_DIR, 'videosum.json');

interface DB {
  settings: Record<string, string>;
  tasks: Record<string, any>;
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ settings: {}, tasks: {} } as DB, null, 2));
  }
}

function read(): DB {
  ensure();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const obj = JSON.parse(raw);
    if (!obj.settings) obj.settings = {};
    if (!obj.tasks) obj.tasks = {};
    return obj;
  } catch {
    return { settings: {}, tasks: {} };
  }
}

function write(db: DB) {
  ensure();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getSetting(key: string): string | null {
  return read().settings[key] ?? null;
}

export function setSetting(key: string, value: string) {
  const db = read();
  db.settings[key] = value;
  write(db);
}

export function getTask(id: string): any | null {
  return read().tasks[id] ?? null;
}

export function saveTask(task: any) {
  const db = read();
  db.tasks[task.id] = task;
  write(db);
}

export function getAllTasks(): any[] {
  const db = read();
  return Object.values(db.tasks).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function deleteTask(id: string): boolean {
  const db = read();
  if (!db.tasks[id]) return false;
  delete db.tasks[id];
  write(db);
  return true;
}

export { DATA_DIR };
