# 智能客服对话质检平台

一个基于 React + Vite + TailwindCSS 的客服回复人工质检工具，支持逐条浏览、标签多选、备注、自动保存、CSV 导出和 DeepSeek AI 辅助分析。

## 安装

```bash
npm install
```

## 启动

```bash
npm run dev
```

## 打包

```bash
npm run build
```

## DeepSeek 配置

项目默认从环境变量读取 DeepSeek API Key：

```bash
VITE_DEEPSEEK_API_KEY=your_api_key_here
VITE_DEEPSEEK_MODEL=deepseek-chat
```

建议先复制 `.env.example` 为 `.env`，再填写自己的 API Key。修改后需要重新启动开发服务器。

如果没有配置 API Key，人工标注、保存和 CSV 导出仍然可用，但 AI 分析会提示缺少密钥。

## 数据文件

运行时读取的是 [public/data/conversations.json](public/data/conversations.json)，本地标注结果保存在浏览器 `localStorage` 中，不会覆盖原始对话数据。

## 功能说明

- 逐条浏览客服对话
- 支持 6 个质检标签多选
- 自动保存标注结果到本地
- 导出 CSV，字段包含 id、user、assistant、labels、comment
- 调用 DeepSeek 返回 JSON 结果并自动回填标签
- 支持浅色和深色模式切换

## 目录结构

```text
customer-service-review/
├─ public/
│  └─ data/
│     └─ conversations.json
├─ src/
│  ├─ components/
│  ├─ hooks/
│  └─ lib/
├─ index.html
├─ package.json
├─ tailwind.config.js
├─ postcss.config.js
└─ vite.config.js
```
