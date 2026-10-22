# 智能客服对话质检平台

> **Phase 1 MVP** - 一个基于 React + Vite + TailwindCSS 的智能客服质检工具，结合 AI 辅助和人工审核，提升质检效率 5-10 倍。

## ✨ 核心特性

- 🚀 **多格式数据导入** - 支持 JSON、CSV、Excel 文件导入
- 🤖 **AI 智能分析** - 集成 DeepSeek AI，自动分析对话质量
- ⚡ **高效标注** - 键盘快捷键 + 自动保存，单条审核 < 1 分钟
- 📊 **数据洞察** - 可视化统计 + 多维度分析
- 📄 **报告导出** - 支持 CSV、Excel、PDF 多格式导出
- 🎨 **深色模式** - 支持浅色/深色主题切换
- 💾 **本地存储** - 数据不离开本地，保护隐私

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 运行测试

项目使用 **Vitest + React Testing Library**（jsdom 环境），覆盖数据层、Hooks、UI 组件与 App 用户流程。

```bash
npm test                 # 全量测试
npm run test:unit        # 仅单元测试（数据层 / Hooks / 组件）
npm run test:integration # 仅 App 集成测试
npm run test:watch       # 监听模式
npm run test:coverage    # 全量测试 + 覆盖率报告（coverage/index.html）
```

测试文件的组织方式：

> 当前状态：**62 个测试文件 / 895 条用例全部通过**，行覆盖率 **99.11%**、分支覆盖率 **96.89%**、函数覆盖 **99.63%**（2026-10-22，含前端性能优化与可访问性修复回归）。
> 详细用例清单见 `docx/测试用例文档.md`，执行结果见 `docx/测试报告.md`。

```
tests/
├── setup.js                    # jsdom 环境补齐 + 全局清理
├── helpers/file.js             # 测试数据工厂（JSON/CSV/Excel 文件、对话、标注）
├── unit/
│   ├── lib/                    # 核心库与解析器单元测试
│   ├── hooks/                  # Hooks 单元测试
│   └── components/             # UI 组件测试
└── integration/                # App 端到端用户流程测试
```

## ⚙️ 配置

### DeepSeek API 配置

在应用内点击底部操作栏的「设置」，填写 **DeepSeek API Key**（可选模型与批量分析默认并发），保存即可：

- API Key 仅保存在本机浏览器 `localStorage`（配置项 `cs-review-config-v1`），不会上传到服务器
- **不再通过构建期环境变量注入**（`VITE_DEEPSEEK_API_KEY` 已废弃），避免 Key 被打进前端产物
- `VITE_DEEPSEEK_MODEL` 仍可作为模型默认值（不敏感）

> 💡 如果没有配置 API Key，人工质检功能仍可正常使用，但 AI 分析与批量分析功能将不可用。

## 📖 使用说明

### 1. 导入对话数据

支持以下格式：
- **JSON** - 标准对话数据格式
- **CSV** - 包含 id、user、assistant 列
- **Excel** - .xlsx 或 .xls 格式

### 2. 质检标注

- 选择问题标签（支持多选）
- 打质量评分（1-5 分）
- 添加备注说明
- 自动保存到本地

**快捷键：**
- `1-6` - 快速切换标签
- `Alt+1~5` - 快速评分
- `Enter` - 下一条
- `Shift+Enter` - 上一条
- `A` - AI 分析
- `D` - 切换深色模式

### 3. AI 辅助分析

- 单条分析：点击「AI 分析」按钮
- 批量分析：在数据管理页面批量处理
- AI 返回：标签建议 + 分析理由 + 置信度

### 4. 统计分析

- 质检进度、平均评分
- 标签分布饼图
- 评分分布柱状图
- 质量趋势折线图
- 问题对话列表

### 5. 导出报告

- **CSV** - 原始数据导出
- **Excel** - 包含明细、统计、问题对话多个 Sheet
- **PDF** - 专业质检报告（开发中）

## 📁 项目结构

```
customer-service-review/
├── public/
│   └── data/
│       └── conversations.json          # 示例对话数据
├── src/
│   ├── components/                     # React 组件
│   │   ├── common/                    # 通用组件
│   │   ├── import/                    # 数据导入
│   │   ├── review/                    # 质检标注
│   │   ├── analysis/                  # AI 分析
│   │   ├── dashboard/                 # 统计分析
│   │   ├── export/                    # 报告导出
│   │   └── settings/                  # 设置
│   ├── hooks/                          # 自定义 Hooks
│   ├── lib/                            # 核心库
│   │   ├── parsers/                   # 数据解析器
│   │   │   ├── json.js               # JSON 解析
│   │   │   ├── csv.js                # CSV 解析
│   │   │   ├── excel.js              # Excel 解析
│   │   │   ├── validator.js          # 数据验证
│   │   │   └── index.js              # 统一导出
│   │   ├── exporters/                 # 数据导出器
│   │   ├── ai/                        # AI 服务
│   │   ├── constants.js               # 常量定义
│   │   ├── utils.js                   # 工具函数
│   │   ├── storage.js                 # 本地存储
│   │   └── analytics.js               # 数据分析
│   ├── styles/                         # 样式文件
│   ├── App.jsx                         # 应用主组件
│   └── main.jsx                        # 应用入口
├── docx/                               # 项目文档
│   ├── 产品规划文档.md
│   ├── 需求分析报告.md
│   ├── PRD-产品需求文档.md
│   ├── 概要设计说明书.md
│   ├── 测试计划.md
│   ├── 测试用例文档.md
│   ├── 测试报告.md
│   ├── 用户手册.md                     # 面向质检员的操作说明
│   ├── 前端优化方案.md                 # 性能/可访问性优化与实测记录
│   ├── 项目开发进度追踪.md
│   └── 开发启动计划.md
├── tests/                              # 自动化测试
│   ├── setup.js                        # Vitest 全局初始化与 jsdom polyfill
│   ├── helpers/file.js                 # 测试数据工厂
│   ├── unit/                           # 单元测试（lib / hooks / components）
│   └── integration/                    # App 集成测试
├── vitest.config.js                    # Vitest 配置（jsdom + 覆盖率）
├── .env.example                        # 环境变量示例
├── package.json                        # 项目依赖
├── vite.config.js                      # Vite 配置
├── tailwind.config.js                  # TailwindCSS 配置
└── README.md                           # 项目说明

```

## 🛠️ 技术栈

### 核心技术
- **React 18.3** - 前端框架
- **Vite 5.4** - 构建工具
- **TailwindCSS 3.4** - CSS 框架

### 主要依赖
- **recharts** - 数据可视化
- **papaparse** - CSV 解析
- **xlsx** - Excel 处理
- **jspdf** - PDF 生成
- **react-hot-toast** - Toast 提示
- **react-window** - 虚拟滚动
- **p-limit** - 并发控制

## 📊 开发进度

### ✅ 已完成（Phase 1 核心功能）
- [x] 项目初始化 / 基础架构 / 工具函数库 / LocalStorage 封装 / 数据验证
- [x] 数据导入（JSON / CSV / Excel 三步向导、字段映射、跳过行提示）
- [x] 质检标注（标签 / 评分 / 备注 / 自动保存 / 快捷键）
- [x] AI 分析（DeepSeek 单条 + 批量并发，结果只作建议、不覆盖人工结论）
- [x] 统计仪表盘 + 数据管理页（筛选 / 搜索 / 分页 / 跳转 / 导出筛选结果）
- [x] 报告导出（CSV / Excel 多 Sheet / PDF）
- [x] 设置页（API Key 运行时配置、模型 / 并发、标注备份导入导出）
- [x] 深色模式、弹窗可访问性（dialog 语义 / 焦点锁定 / Esc 关闭）
- [x] 全局错误边界（chunk 加载失败可恢复，不再整页白屏）
- [x] 前端性能优化（Dashboard 懒加载、图表动画关闭，主包 596 KB → 190 KB / gzip 179 → 60 KB，CLS 0）
- [x] 可访问性达标（Lighthouse Accessibility 100 / Best Practices 100）
- [x] 测试工程（Vitest + React Testing Library：895 条用例，行覆盖 99.11%）
- [x] CI 门禁（GitHub Actions：push/PR 自动跑测试 + 覆盖率阈值）
- [x] 部署上线（GitHub Pages 自动部署：https://foolgone.github.io/customer-service-review/ ）
- [x] 用户手册（面向质检员的操作说明：`docx/用户手册.md`）

### 📅 计划中
- [ ] 真实浏览器 E2E（Playwright：导入 → 标注 → 导出 → 批量分析）
- [ ] 技术债收口（单条 AI 分析统一到 Provider 抽象、CSV 导出并入 `lib/exporters`）
- [ ] 部署平台迁移（Vercel / Netlify：immutable 长缓存 + PR 预览环境）
- [ ] 其他服务商 AI Provider 接入（OpenAI / Claude）

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📮 联系方式

如有问题或建议，请提交 Issue。

---

**当前版本**: v1.0.0 (Phase 1 MVP)  
**最后更新**: 2026-10-22
