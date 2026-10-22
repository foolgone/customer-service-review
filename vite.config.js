import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 是项目站点（https://<user>.github.io/<repo>/），需要子路径 base；
// 本地 dev / 根路径部署保持 '/'。部署工作流通过 GITHUB_PAGES=true 打开子路径模式。
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? '/customer-service-review/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // 测试覆盖率 / 构建产物 / 截图目录不属于源码，避免 vitest 重跑覆盖率时触发整页 reload
    watch: {
      ignored: ['**/coverage/**', '**/dist/**', '**/.preview/**', '**/node_modules/**'],
    },
  },
});
