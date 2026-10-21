/**
 * 根据 Vitest JSON 结果与覆盖率报告，自动生成：
 *   - docx/测试用例文档.md
 *   - docx/测试报告.md
 *
 * 用法：
 *   npx vitest run --coverage --reporter=json --outputFile=.tmp/test-results.json
 *   node scripts/generate-test-docs.mjs
 *
 * 说明：用例文档由测试代码的 describe/it 名称自动汇总，保证文档与代码一致。
 * 疑似缺陷等人工结论可写入 .tmp/issues.json（数组，元素 { title, severity, detail }），
 * 生成时自动并入《测试报告》的缺陷章节。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const resultsPath = path.join(root, '.tmp', 'test-results.json');
const coveragePath = path.join(root, 'coverage', 'coverage-summary.json');
const issuesPath = path.join(root, '.tmp', 'issues.json');

if (!fs.existsSync(resultsPath)) {
  console.error(`缺少测试结果文件：${resultsPath}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const coverage = fs.existsSync(coveragePath) ? JSON.parse(fs.readFileSync(coveragePath, 'utf8')) : null;
const issues = fs.existsSync(issuesPath) ? JSON.parse(fs.readFileSync(issuesPath, 'utf8')) : [];

const toPosix = (p) => p.replace(/\\/g, '/');
const rel = (absPath) => toPosix(path.relative(root, absPath));

/** 测试文件元信息：模块名、被测源码、用例编号前缀、优先级 */
const FILE_META = [
  { match: 'tests/unit/lib/utils.test.js', module: '核心库-通用工具', source: 'src/lib/utils.js', prefix: 'UTIL', priority: 'P0' },
  { match: 'tests/unit/lib/constants.test.js', module: '核心库-常量定义', source: 'src/lib/constants.js', prefix: 'CONST', priority: 'P2' },
  { match: 'tests/unit/lib/storage.test.js', module: '核心库-本地存储', source: 'src/lib/storage.js', prefix: 'STORE', priority: 'P0' },
  { match: 'tests/unit/lib/analytics.test.js', module: '核心库-统计分析', source: 'src/lib/analytics.js', prefix: 'ANA', priority: 'P0' },
  { match: 'tests/unit/lib/csv.test.js', module: '核心库-CSV 导出', source: 'src/lib/csv.js', prefix: 'CSV', priority: 'P1' },
  { match: 'tests/unit/lib/deepseek.test.js', module: '核心库-AI 服务', source: 'src/lib/deepseek.js', prefix: 'AI', priority: 'P1' },
  { match: 'tests/unit/lib/performance.test.js', module: '核心库-性能配置', source: 'src/lib/performance.js', prefix: 'PERF', priority: 'P2' },
  { match: 'tests/unit/lib/parsers/validator.test.js', module: '数据导入-数据校验', source: 'src/lib/parsers/validator.js', prefix: 'VAL', priority: 'P0' },
  { match: 'tests/unit/lib/parsers/json.test.js', module: '数据导入-JSON 解析', source: 'src/lib/parsers/json.js', prefix: 'JSON', priority: 'P0' },
  { match: 'tests/unit/lib/parsers/csv.test.js', module: '数据导入-CSV 解析', source: 'src/lib/parsers/csv.js', prefix: 'CSVP', priority: 'P0' },
  { match: 'tests/unit/lib/parsers/excel.test.js', module: '数据导入-Excel 解析', source: 'src/lib/parsers/excel.js', prefix: 'XLS', priority: 'P1' },
  { match: 'tests/unit/lib/parsers/index.test.js', module: '数据导入-解析调度', source: 'src/lib/parsers/index.js', prefix: 'PARSER', priority: 'P1' },
  { match: 'tests/unit/lib/ai/batch.test.js', module: 'AI-批量执行器', source: 'src/lib/ai/batch.js', prefix: 'AI-BATCH', priority: 'P0' },
  { match: 'tests/unit/lib/ai/providers.test.js', module: 'AI-Provider 抽象', source: 'src/lib/ai/providers.js', prefix: 'AI-PROV', priority: 'P1' },
  { match: 'tests/unit/lib/ai/edge-cases.test.js', module: 'AI-边界与统一入口', source: 'src/lib/ai/*.js', prefix: 'AI-EDGE', priority: 'P1' },
  { match: 'tests/unit/hooks/useTheme.test.jsx', module: 'Hooks-主题管理', source: 'src/hooks/useTheme.js', prefix: 'THEME', priority: 'P1' },
  { match: 'tests/unit/hooks/useKeyboardShortcuts.test.jsx', module: 'Hooks-全局快捷键', source: 'src/hooks/useKeyboardShortcuts.js', prefix: 'KEY', priority: 'P0' },
  { match: 'tests/unit/components/ChatBubble.test.jsx', module: '组件-消息气泡', source: 'src/components/ChatBubble.jsx', prefix: 'UI-BUBBLE', priority: 'P1' },
  { match: 'tests/unit/components/ConversationPanel.test.jsx', module: '组件-对话面板', source: 'src/components/ConversationPanel.jsx', prefix: 'UI-CONV', priority: 'P1' },
  { match: 'tests/unit/components/LabelSelector.test.jsx', module: '组件-标签选择器', source: 'src/components/LabelSelector.jsx', prefix: 'UI-LABEL', priority: 'P0' },
  { match: 'tests/unit/components/ScoreSelector.test.jsx', module: '组件-评分选择器', source: 'src/components/ScoreSelector.jsx', prefix: 'UI-SCORE', priority: 'P0' },
  { match: 'tests/unit/components/ActionBar.test.jsx', module: '组件-操作栏', source: 'src/components/ActionBar.jsx', prefix: 'UI-ACTION', priority: 'P1' },
  { match: 'tests/unit/components/AnalysisPanel.test.jsx', module: '组件-AI 分析面板', source: 'src/components/AnalysisPanel.jsx', prefix: 'UI-AI', priority: 'P1' },
  { match: 'tests/unit/components/Dashboard.test.jsx', module: '组件-统计仪表盘', source: 'src/components/Dashboard.jsx', prefix: 'UI-DASH', priority: 'P2' },
  { match: 'tests/unit/components/import/FileUploader.test.jsx', module: '组件-导入-文件上传', source: 'src/components/import/FileUploader.jsx', prefix: 'UI-UP', priority: 'P1' },
  { match: 'tests/unit/components/import/DataPreview.test.jsx', module: '组件-导入-数据预览', source: 'src/components/import/DataPreview.jsx', prefix: 'UI-PREV', priority: 'P1' },
  { match: 'tests/unit/components/import/ImportWizard.test.jsx', module: '组件-导入-三步向导', source: 'src/components/import/ImportWizard.jsx', prefix: 'UI-IMPORT', priority: 'P0' },
  { match: 'tests/unit/components/ai/BatchAnalysisPanel.test.jsx', module: '组件-批量分析面板', source: 'src/components/ai/BatchAnalysisPanel.jsx', prefix: 'UI-BATCH', priority: 'P0' },
  { match: 'tests/integration/batch-analysis.test.jsx', module: '集成-批量分析流程', source: 'src/App.jsx', prefix: 'APP-BATCH', priority: 'P0' },
  { match: 'tests/integration/', module: '集成-App 用户流程', source: 'src/App.jsx', prefix: 'APP', priority: 'P0' },
  { match: 'tests/unit/env.test.js', module: '测试基础设施', source: 'vitest.config.js / tests/setup.js', prefix: 'ENV', priority: 'P2' }
];

function getMeta(relPath) {
  const found = FILE_META.find((item) => relPath.includes(item.match));
  if (found) return found;
  return {
    module: `其他-${path.basename(relPath).replace(/\.test\.(js|jsx)$/, '')}`,
    source: '-',
    prefix: 'MISC',
    priority: 'P2'
  };
}

/** 汇总测试用例 */
const suites = results.testResults.map((suite) => {
  const relPath = rel(suite.name);
  const meta = getMeta(relPath);
  const cases = (suite.assertionResults || []).map((item, index) => ({
    id: `${meta.prefix}-${String(index + 1).padStart(2, '0')}`,
    module: meta.module,
    source: meta.source,
    priority: meta.priority,
    file: relPath,
    fullTitle: [...(item.ancestorTitles || []), item.title].join(' / '),
    title: item.title,
    status: item.status,
    durationMs: item.duration || 0
  }));
  return { relPath, meta, cases };
});

const allCases = suites.flatMap((suite) => suite.cases);
const total = allCases.length;
const passed = allCases.filter((item) => item.status === 'passed').length;
const failed = allCases.filter((item) => item.status === 'failed');
const skipped = total - passed - failed.length;
const passRate = total ? ((passed / total) * 100).toFixed(1) : '0.0';
const totalDurationMs = allCases.reduce((sum, item) => sum + (item.durationMs || 0), 0);
const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vitestVersion = packageJson.devDependencies?.vitest || '-';
const nodeVersion = process.version;

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };
allCases.sort((a, b) => {
  const left = `${PRIORITY_ORDER[a.priority]}-${a.module}-${a.id}`;
  const right = `${PRIORITY_ORDER[b.priority]}-${b.module}-${b.id}`;
  return left.localeCompare(right);
});

// ==================== 测试用例文档 ====================
const caseLines = [];
caseLines.push('# 智能客服对话质检平台 - 测试用例文档');
caseLines.push('');
caseLines.push('> **文档版本**：v1.0');
caseLines.push(`> **生成时间**：${generatedAt}`);
caseLines.push('> **数据来源**：本文件由 `scripts/generate-test-docs.mjs` 从 Vitest 执行结果自动生成，与 `tests/` 下的测试代码一一对应，避免文档与代码漂移。');
caseLines.push('> **维护方式**：新增/修改测试后执行 `npm run test:coverage` 并重新生成，请勿手工编辑（人工结论请写入 `.tmp/issues.json`）。');
caseLines.push('');
caseLines.push('## 1. 文档说明');
caseLines.push('');
caseLines.push('- **用例编号**：`<模块前缀>-<序号>`，例如 `UTIL-01`、`APP-12`。');
caseLines.push('- **用例名称**：`describe / it` 的完整路径，按「前置条件 → 操作 → 预期结果」的语义书写。');
caseLines.push('- **优先级**：P0（核心链路，失败即阻断）、P1（重要功能）、P2（辅助能力 / 基础设施）。');
caseLines.push('- **自动化文件**：用例所在测试文件，可直接运行定位；断言细节以测试代码为准。');
caseLines.push('');
caseLines.push('## 2. 覆盖概览');
caseLines.push('');
caseLines.push('| 指标 | 数值 |');
caseLines.push('|------|------|');
caseLines.push(`| 测试文件数 | ${suites.length} |`);
caseLines.push(`| 用例总数 | ${total} |`);
caseLines.push(`| 通过 / 失败 / 跳过 | ${passed} / ${failed.length} / ${skipped} |`);
caseLines.push(`| 通过率 | ${passRate}% |`);
caseLines.push(`| 用例执行总耗时 | ${(totalDurationMs / 1000).toFixed(2)} s |`);
caseLines.push('');
caseLines.push('### 2.1 分层统计');
caseLines.push('');
caseLines.push('| 层级 | 模块数 | 用例数 |');
caseLines.push('|------|--------|--------|');
const layerOf = (moduleName) => {
  if (moduleName.startsWith('AI-')) return '单元测试 / AI 能力';
  if (moduleName.startsWith('数据导入')) return '单元测试 / 数据导入层';
  if (moduleName.startsWith('核心库')) return '单元测试 / 核心库';
  if (moduleName.startsWith('Hooks')) return '单元测试 / Hooks';
  if (moduleName.startsWith('组件')) return '组件测试 / UI';
  if (moduleName.startsWith('集成')) return '集成测试 / 页面流程';
  return '测试基础设施';
};
const layerMap = new Map();
for (const suite of suites) {
  const layer = layerOf(suite.meta.module);
  const entry = layerMap.get(layer) || { modules: 0, cases: 0 };
  entry.modules += 1;
  entry.cases += suite.cases.length;
  layerMap.set(layer, entry);
}
for (const [layer, entry] of [...layerMap.entries()].sort()) {
  caseLines.push(`| ${layer} | ${entry.modules} | ${entry.cases} |`);
}
caseLines.push('');
caseLines.push('### 2.2 模块与源码映射');
caseLines.push('');
caseLines.push('| 模块 | 被测源码 | 用例数 | 自动化文件 |');
caseLines.push('|------|----------|--------|------------|');
for (const suite of suites) {
  caseLines.push(`| ${suite.meta.module} | \`${suite.meta.source}\` | ${suite.cases.length} | \`${suite.relPath}\` |`);
}
caseLines.push('');

const byPriority = { P0: [], P1: [], P2: [] };
for (const item of allCases) {
  (byPriority[item.priority] || byPriority.P2).push(item);
}

for (const priority of ['P0', 'P1', 'P2']) {
  const group = byPriority[priority];
  if (!group.length) continue;
  const priorityLabel = { P0: '核心链路（P0）', P1: '重要功能（P1）', P2: '辅助能力与基础设施（P2）' }[priority];
  caseLines.push(`## ${priority === 'P0' ? '3' : priority === 'P1' ? '4' : '5'}. ${priorityLabel}`);
  caseLines.push('');
  const moduleGroups = new Map();
  for (const item of group) {
    if (!moduleGroups.has(item.module)) moduleGroups.set(item.module, []);
    moduleGroups.get(item.module).push(item);
  }
  for (const [moduleName, items] of moduleGroups) {
    caseLines.push(`### ${moduleName}`);
    caseLines.push('');
    caseLines.push('| 用例编号 | 用例名称 | 自动化文件 | 结果 |');
    caseLines.push('|----------|----------|------------|------|');
    for (const item of items) {
      const statusLabel = item.status === 'passed' ? '✅ 通过' : item.status === 'failed' ? '❌ 失败' : '⏭️ 跳过';
      caseLines.push(`| ${item.id} | ${item.fullTitle} | \`${item.file}\` | ${statusLabel} |`);
    }
    caseLines.push('');
  }
}

caseLines.push('## 6. 执行方式');
caseLines.push('');
caseLines.push('```bash');
caseLines.push('npm test                    # 全量用例');
caseLines.push('npm run test:unit           # 单元测试');
caseLines.push('npm run test:integration    # 集成测试');
caseLines.push('npm run test:coverage       # 全量 + 覆盖率');
caseLines.push('npx vitest run tests/unit/lib/parsers/json.test.js   # 单文件');
caseLines.push('```');
caseLines.push('');
caseLines.push('## 7. 维护约定');
caseLines.push('');
caseLines.push('1. 每个新增功能至少补充 1 条 P0/P1 用例（正常路径 + 关键异常路径各 1 条更佳）。');
caseLines.push('2. 用例名称必须表达业务语义，禁止 `test1`、`should work` 等无信息量命名。');
caseLines.push('3. 修改源码公共契约时，同步更新用例与期望；不得通过删除断言「修复」失败。');
caseLines.push('4. 新增测试文件后重新生成本文件，保证文档与代码一致。');
caseLines.push('');

// ==================== 测试报告 ====================
const reportLines = [];
reportLines.push('# 智能客服对话质检平台 - 测试报告');
reportLines.push('');
reportLines.push('> **报告版本**：v1.0');
reportLines.push(`> **执行时间**：${generatedAt}`);
reportLines.push(`> **执行环境**：Node.js ${nodeVersion} / Vitest ${vitestVersion} / jsdom / Windows`);
reportLines.push('> **执行命令**：`npm run test:coverage`（`npx vitest run --coverage`）');
reportLines.push('');
reportLines.push('## 1. 执行结论');
reportLines.push('');
const conclusion = failed.length === 0 ? '**通过**（全部用例执行成功）' : `**未通过**（${failed.length} 条用例失败）`;
reportLines.push(`本轮共执行 **${suites.length}** 个测试文件、**${total}** 条用例，通过 **${passed}** 条，失败 **${failed.length}** 条，跳过 **${skipped}** 条，通过率 **${passRate}%**。总体结论：${conclusion}。`);
reportLines.push('');
reportLines.push('| 指标 | 数值 |');
reportLines.push('|------|------|');
reportLines.push(`| 测试文件 | ${suites.length} |`);
reportLines.push(`| 用例总数 | ${total} |`);
reportLines.push(`| 通过 | ${passed} |`);
reportLines.push(`| 失败 | ${failed.length} |`);
reportLines.push(`| 跳过 | ${skipped} |`);
reportLines.push(`| 通过率 | ${passRate}% |`);
reportLines.push(`| 用例总耗时 | ${(totalDurationMs / 1000).toFixed(2)} s |`);
reportLines.push('');

reportLines.push('## 2. 分层执行结果');
reportLines.push('');
reportLines.push('| 层级 | 测试文件 | 用例数 | 通过 | 失败 |');
reportLines.push('|------|----------|--------|------|------|');
for (const [layer] of [...layerMap.entries()].sort()) {
  const layerSuites = suites.filter((suite) => layerOf(suite.meta.module) === layer);
  const layerCases = layerSuites.flatMap((suite) => suite.cases);
  const layerFailed = layerCases.filter((item) => item.status === 'failed').length;
  reportLines.push(`| ${layer} | ${layerSuites.length} | ${layerCases.length} | ${layerCases.length - layerFailed} | ${layerFailed} |`);
}
reportLines.push('');

reportLines.push('## 3. 失败用例明细');
reportLines.push('');
if (!failed.length) {
  reportLines.push('无。全部用例通过。');
} else {
  reportLines.push('| 用例编号 | 用例名称 | 文件 | 失败信息 |');
  reportLines.push('|----------|----------|------|----------|');
  for (const item of failed) {
    reportLines.push(`| ${item.id} | ${item.fullTitle} | \`${item.file}\` | 见测试日志 |`);
  }
}
reportLines.push('');

reportLines.push('## 4. 覆盖率');
reportLines.push('');
if (coverage && coverage.total) {
  const fmt = (value) => (typeof value === 'number' ? `${value.toFixed(2)}%` : '-');
  reportLines.push('| 范围 | 语句覆盖 | 分支覆盖 | 函数覆盖 | 行覆盖 |');
  reportLines.push('|------|----------|----------|----------|--------|');
  reportLines.push(`| **全部源代码** | ${fmt(coverage.total.statements.pct)} | ${fmt(coverage.total.branches.pct)} | ${fmt(coverage.total.functions.pct)} | ${fmt(coverage.total.lines.pct)} |`);
  const rows = Object.entries(coverage)
    .filter(([file]) => file !== 'total' && file.includes(`${path.sep}src${path.sep}`))
    .map(([file, data]) => ({ file: rel(file), ...data }))
    .sort((a, b) => a.file.localeCompare(b.file));
  for (const row of rows) {
    reportLines.push(`| \`${row.file}\` | ${fmt(row.statements.pct)} | ${fmt(row.branches.pct)} | ${fmt(row.functions.pct)} | ${fmt(row.lines.pct)} |`);
  }
  reportLines.push('');
  reportLines.push('> HTML 明细报告：`coverage/index.html`；机器可读汇总：`coverage/coverage-summary.json`。');
} else {
  reportLines.push('本次执行未生成覆盖率数据。请运行 `npm run test:coverage` 后重新生成报告。');
}
reportLines.push('');

reportLines.push('## 5. 缺陷与待处理项');
reportLines.push('');
if (issues.length) {
  reportLines.push('| 编号 | 严重程度 | 状态 | 标题 | 说明 |');
  reportLines.push('|------|----------|------|------|------|');
  issues.forEach((issue, index) => {
    reportLines.push(`| BUG-${String(index + 1).padStart(2, '0')} | ${issue.severity || '一般'} | ${issue.status || '待处理'} | ${issue.title} | ${issue.detail || '-'} |`);
  });
} else {
  reportLines.push('本轮未记录疑似缺陷。');
}
reportLines.push('');
reportLines.push('**已知风险**：');
reportLines.push('');
reportLines.push('1. 测试运行于 jsdom 而非真实浏览器，布局、滚动、图表渲染等视觉行为不在自动化范围内。');
reportLines.push('2. DeepSeek 真实网络调用被 mock 替代，接口字段变化需通过契约测试补充保障。');
reportLines.push('3. `.tmp/` 与 `coverage/` 为本地生成物，不纳入版本控制。');
reportLines.push('');

reportLines.push('## 6. 结论与建议');
reportLines.push('');
reportLines.push(`1. 数据层、Hooks、UI 组件与 App 主流程已建立自动化回归保护，用例总数 **${total}** 条，通过率 **${passRate}%**。`);
const fixedCount = issues.filter((issue) => issue.status === '已修复').length;
const openCount = issues.length - fixedCount;
const regressionCount = allCases.filter((item) => /BUG-\d+ 已修复/.test(item.fullTitle)).length;
if (fixedCount) {
  reportLines.push(`2. 测试报告累计提出的 **${issues.length}** 项问题中，**${fixedCount}** 项已修复（含 **${regressionCount}** 条带 BUG 编号的回归用例，另有断言更新覆盖其余修复项）；**${openCount}** 项为本阶段新增的待处理/待确认观察项。`);
} else if (openCount) {
  reportLines.push(`2. 本轮记录 **${openCount}** 项待处理/待确认观察项，详见第 5 节。`);
}
reportLines.push(`${fixedCount ? 3 : 2}. CI 门禁已接入（\`.github/workflows/test.yml\`，push/PR 自动执行并校验覆盖率阈值）；建议在仓库分支保护中把 Test 检查设为合并必需项。`);
reportLines.push(`${fixedCount ? 4 : 3}. 后续优先补充：PDF/Excel 报告导出（待实现）、真实浏览器 E2E（Playwright）、DeepSeek 接口契约测试。`);
reportLines.push('');

fs.mkdirSync(path.join(root, 'docx'), { recursive: true });
fs.writeFileSync(path.join(root, 'docx', '测试用例文档.md'), `${caseLines.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(root, 'docx', '测试报告.md'), `${reportLines.join('\n')}\n`, 'utf8');

console.log(`已生成文档：docx/测试用例文档.md（${total} 条用例，通过 ${passed}，失败 ${failed.length}）`);
console.log('已生成文档：docx/测试报告.md');
if (!coverage) {
  console.warn('警告：未找到 coverage/coverage-summary.json，测试报告不含覆盖率数据。');
}
