import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 关键：打包后走 file:// 协议（asar 内），资源用相对路径才能加载。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // 不清空 dist：本环境对批量删除有保护，vite 的 emptyOutDir 会触发阈值被拒。
    emptyOutDir: false,
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
