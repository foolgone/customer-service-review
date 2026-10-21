import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // 测试覆盖率 / 构建产物 / 截图目录不属于源码，避免 vitest 重跑覆盖率时触发整页 reload
    watch: {
      ignored: ['**/coverage/**', '**/dist/**', '**/.preview/**', '**/node_modules/**']
    }
  }
});
