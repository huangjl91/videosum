// 开发模式启动器：设置 ELECTRON_DEV=1 后拉起 electron，加载 vite dev server (5173)。
// 使用前先另开终端跑 `npm run dev` 启动 vite。
const { spawn } = require('child_process');

process.env.ELECTRON_DEV = '1';
const electron = require('electron');

const child = spawn(electron, ['.'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code === null ? 0 : code));
