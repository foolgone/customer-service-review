/**
 * 全局错误兜底
 *
 * 防护对象：
 * 1. lazy 加载的 chunk 失败——发版后旧页面仍在请求旧哈希文件，动态 import 会被 reject；
 * 2. 渲染期未捕获的异常，避免整页白屏（React 不捕获事件处理函数里的错误，本组件也不负责）。
 *
 * 兜底 UI 只给「重新加载」：chunk 404 只有刷新才能拿到新哈希；标注都存在 localStorage，刷新不丢数据。
 * 如需自定义行为（例如测试或上报），可通过 onReload 覆盖默认的 window.location.reload。
 */
import { Component } from 'react';

// Vite / Webpack / Chrome 对「动态 import 失败」的文案各不相同，统一识别
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

export function isChunkLoadError(error) {
  return CHUNK_ERROR_PATTERN.test(String(error?.message || error || ''));
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // 目前没有接入错误监控服务，先保留控制台日志，方便用户反馈时截图定位
    console.error('ErrorBoundary 捕获到错误：', error, errorInfo);
  }

  handleReload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }

    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const isChunkError = isChunkLoadError(error);

    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card max-w-xl rounded-xl px-8 py-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Something went wrong</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isChunkError ? '页面需要重新加载' : '页面出现了一个错误'}
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
            {isChunkError
              ? '应用可能刚发布了新版本，当前页面仍在请求已失效的资源文件。重新加载即可恢复；已保存的标注都在本地，不会丢失。'
              : error.message || '未知错误，请重新加载后再试。'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
