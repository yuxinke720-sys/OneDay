import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { fileURLToPath, URL } from 'node:url';

// Vite 配置：开发期把 /api、/uploads、/health 反向代理到 Elysia 后端，
// 这样前端代码里所有路径都用相对路径，不必写 http://localhost:3000，
// 未来打包到 Capacitor / 部署到正式域名也能无缝迁移。

export default defineConfig({
  plugins: [
    vue(),
    Components({ resolvers: [VantResolver()], dts: 'src/components.d.ts' }),
  ],
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
    ],
  },
  server: {
    host: '0.0.0.0', // 允许手机同 Wi-Fi 直接访问，便于真机调试
    port: 5173,
    proxy: {
      '/api':     { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/health':  { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
