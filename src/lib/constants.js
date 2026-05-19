export const LABELS = [
  { value: 'accurate', label: '回复准确', description: '回复准确', shortcut: '1', color: 'emerald' },
  { value: 'off_topic', label: '跑题', description: '跑题', shortcut: '2', color: 'amber' },
  { value: 'hallucination', label: '编造信息', description: '编造信息', shortcut: '3', color: 'rose' },
  { value: 'impolite', label: '态度差', description: '态度差', shortcut: '4', color: 'orange' },
  { value: 'incomplete', label: '未解决问题', description: '未解决问题', shortcut: '5', color: 'sky' },
  { value: 'risky', label: '风险回复', description: '风险回复', shortcut: '6', color: 'violet' }
];

export const SCORE_LEVELS = [
  { value: 5, label: '5 分', description: '优秀回复', shortcut: 'Alt+1' },
  { value: 4, label: '4 分', description: '正常回复', shortcut: 'Alt+2' },
  { value: 3, label: '3 分', description: '一般', shortcut: 'Alt+3' },
  { value: 2, label: '2 分', description: '有明显问题', shortcut: 'Alt+4' },
  { value: 1, label: '1 分', description: '严重风险', shortcut: 'Alt+5' }
];

export const QUICK_SHORTCUTS = [
  { key: 'Enter', label: '下一条' },
  { key: 'Ctrl + S', label: '保存' },
  { key: 'A', label: 'AI 分析' },
  { key: 'D', label: '深色模式' },
  { key: '1-6', label: '标签快捷键' },
  { key: 'Alt + 1-5', label: '评分快捷键' }
];

export const STORAGE_KEYS = {
  annotations: 'cs-review-annotations-v1',
  theme: 'cs-review-theme-v1'
};

export const DEFAULT_ANNOTATION = {
  labels: [],
  comment: '',
  score: 3,
  aiLabels: [],
  aiReason: '',
  aiAt: '',
  reviewedAt: '',
  updatedAt: '',
  startedAt: '',
  durationMs: 0
};

export const REVIEWER_PROFILE = {
  name: '质检员',
  team: '智能客服审核组',
  status: '在线'
};

export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';
export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
