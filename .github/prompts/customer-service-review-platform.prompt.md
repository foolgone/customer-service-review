---
description: "生成智能客服对话质检平台项目"
name: "智能客服对话质检平台"
agent: "agent"
argument-hint: "生成一个 React + Vite + TailwindCSS 的客服对话质检平台"
---
你现在是一个资深全栈工程师。

请生成一个完整可运行的「智能客服对话质检平台」项目，要求直接输出所有必要代码文件，不要只给思路，不要省略关键实现。

## 技术栈
- React
- Vite
- TailwindCSS
- 不使用 TypeScript
- 本地 JSON 存储
- 支持 CSV 导出
- 页面简洁现代

## 项目目标
用于人工审核客服回复质量。

项目中将使用 `public/data/conversations.json` 作为对话数据源，数据格式如下：

```json
[
  {
    "id": "001",
    "turns": [
      {
        "role": "user",
        "content": "我三天前买的蓝牙耳机，今天发现左耳没声音，能退款吗？"
      },
      {
        "role": "assistant",
        "content": "非常抱歉给您带来不便..."
      }
    ]
  }
]
```

系统需要支持：
1. 逐条浏览对话
2. 展示用户消息和客服消息
3. 给客服回复打标签
4. 自动保存标注结果
5. 支持导出 CSV
6. 支持 AI 辅助分析
7. 页面现代化、美观

## 标签体系
使用以下标签，支持多选：
- accurate（回复准确）
- off_topic（跑题）
- hallucination（编造信息）
- impolite（态度差）
- incomplete（未解决问题）
- risky（风险回复）

## 页面布局
### 顶部
- 当前对话 ID
- 当前进度，例如 `3 / 100`

### 中间
- 左侧显示用户问题
- 右侧显示客服回复

### 底部
- 标签选择区
- 备注输入框
- 上一条按钮
- 下一条按钮
- 保存按钮
- 导出 CSV 按钮
- AI 分析按钮

## AI 分析功能
点击「AI分析」后，调用 DeepSeek API。

Prompt 如下：

```text
你是客服质检专家。

请判断下面客服回复质量。

用户：
{user}

客服：
{assistant}

标签：
1 accurate
2 off_topic
3 hallucination
4 impolite
5 incomplete
6 risky

返回 JSON：
{
  "labels": [],
  "reason": ""
}
```

AI 返回后需要：
- 自动勾选标签
- 显示分析原因

## 数据存储
- 项目包含 `public/data/conversations.json`
- 本地保存使用 `localStorage`
- 保存格式如下：

```json
{
  "001": {
    "labels": ["accurate"],
    "comment": "回复合理"
  }
}
```

## CSV 导出
导出字段必须包含：
- id
- user
- assistant
- labels
- comment

## UI 要求
- 使用 TailwindCSS
- 卡片风格
- 圆角
- 阴影
- 响应式布局
- 配色简洁高级
- 支持深色模式

## 代码要求
请直接生成完整项目结构和全部代码文件，包括但不限于：
1. 完整项目结构
2. 所有代码文件
3. `package.json`
4. Tailwind 配置
5. `App.jsx`
6. 所有组件
7. CSV 导出逻辑
8. DeepSeek API 调用逻辑
9. `README.md`
10. 启动方式

## README 要求
README 中必须包含：
- 安装：`npm install`
- 启动：`npm run dev`
- 打包：`npm run build`
- DeepSeek 配置：如何填写 API Key

## 输出要求
- 生成的项目必须可以直接运行
- 不要省略代码
- 不要只给方案
- 如果有必要，先补齐合理的目录结构，再逐个文件输出完整内容
- 优先保证实现可读、可维护、可运行
