
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 针对 GitHub Pages 的部署路径进行优化
export default defineConfig({
  plugins: [react()],
  base: '/vpn-sub-hub/', 
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
});
