import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Locale = 'en' | 'zh-CN';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.workflows': 'Workflows',
    'nav.runs': 'Runs',
    'nav.settings': 'Settings',
    'home.title': 'A local-first workspace for AI agent workflows',
    'home.subtitle': 'Run, observe, and control multi-agent workflows with clarity',
    'home.quickActions': 'Quick Actions',
    'home.runTemplate': 'Run a template',
    'home.viewWorkflows': 'View workflows',
    'home.recentRuns': 'Recent Runs',
    'home.noRuns': 'No runs yet',
    'home.systemStatus': 'System Status',
    'home.projectPath': 'Project Path',
    'home.language': 'Language',
    'home.apiKey': 'API Key',
    'home.configured': 'Configured',
    'home.notConfigured': 'Not configured',
    'workflows.title': 'Workflows',
    'workflows.empty': 'No workflows found',
    'workflows.emptyHint': 'Initialize a project with templates first',
    'workflows.steps': 'steps',
    'workflows.agents': 'agents',
    'workflows.run': 'Run',
    'workflows.viewDetail': 'View details',
    'workflows.evalEnabled': 'Eval enabled',
    'runForm.title': 'Run Workflow',
    'runForm.inputPlaceholder': 'Enter your input...',
    'runForm.inputMode': 'Input Mode',
    'runForm.plainText': 'Plain Text',
    'runForm.json': 'JSON',
    'runForm.options': 'Options',
    'runForm.enableStreaming': 'Enable streaming',
    'runForm.autoApproveGates': 'Auto-approve gates',
    'runForm.skipEval': 'Skip evaluation',
    'runForm.submit': 'Run Workflow',
    'runForm.running': 'Running...',
    'runs.title': 'Runs',
    'runs.empty': 'No runs found',
    'runs.status': 'Status',
    'runs.workflow': 'Workflow',
    'runs.createdAt': 'Created',
    'runs.duration': 'Duration',
    'runs.score': 'Score',
    'runs.resume': 'Resume',
    'runs.viewDetail': 'View',
    'runDetail.title': 'Run Details',
    'runDetail.steps': 'Steps',
    'runDetail.output': 'Output',
    'runDetail.logs': 'Logs',
    'runDetail.eval': 'Evaluation',
    'runDetail.gate': 'Gate',
    'runDetail.streaming': 'Streaming output...',
    'runDetail.approve': 'Approve',
    'runDetail.reject': 'Reject',
    'runDetail.edit': 'Edit & Continue',
    'runDetail.gateWaiting': 'Waiting for gate decision',
    'runDetail.tokenUsage': 'Token Usage',
    'runDetail.promptTokens': 'Prompt',
    'runDetail.completionTokens': 'Completion',
    'runDetail.totalTokens': 'Total',
    'runDetail.eventsComingSoon': 'Events log coming soon...',
    'runDetail.evalComingSoon': 'Evaluation coming soon...',
    'runDetail.editPlaceholder': 'Edit output if needed...',
    'runDetail.runId': 'Run ID',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.themeSystem': 'System',
    'settings.projectPath': 'Project Path',
    'settings.apiKey': 'API Key',
    'settings.baseUrl': 'Base URL',
    'settings.status': 'Status',
    'settings.environment': 'Environment',
    'settings.themeComingSoon': 'Theme switching coming soon...',
    'status.pending': 'Pending',
    'status.running': 'Running',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.interrupted': 'Interrupted',
    'status.gate_waiting': 'Awaiting Approval',
    'status.skipped': 'Skipped',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Retry',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
  },
  'zh-CN': {
    'nav.home': '首页',
    'nav.workflows': '工作流',
    'nav.runs': '运行记录',
    'nav.settings': '设置',
    'home.title': '本地优先的 AI Agent 工作流工作区',
    'home.subtitle': '清晰运行、观察和控制多 Agent 工作流',
    'home.quickActions': '快捷操作',
    'home.runTemplate': '运行模板',
    'home.viewWorkflows': '查看工作流',
    'home.recentRuns': '最近运行',
    'home.noRuns': '暂无运行记录',
    'home.systemStatus': '系统状态',
    'home.projectPath': '项目路径',
    'home.language': '语言',
    'home.apiKey': 'API Key',
    'home.configured': '已配置',
    'home.notConfigured': '未配置',
    'workflows.title': '工作流',
    'workflows.empty': '未找到工作流',
    'workflows.emptyHint': '请先初始化模板项目',
    'workflows.steps': '步骤',
    'workflows.agents': '个 Agent',
    'workflows.run': '运行',
    'workflows.viewDetail': '查看详情',
    'workflows.evalEnabled': '已启用评估',
    'runForm.title': '运行工作流',
    'runForm.inputPlaceholder': '请输入内容...',
    'runForm.inputMode': '输入模式',
    'runForm.plainText': '纯文本',
    'runForm.json': 'JSON',
    'runForm.options': '选项',
    'runForm.enableStreaming': '启用流式输出',
    'runForm.autoApproveGates': '自动通过 Gate',
    'runForm.skipEval': '跳过评估',
    'runForm.submit': '运行工作流',
    'runForm.running': '运行中...',
    'runs.title': '运行记录',
    'runs.empty': '暂无运行记录',
    'runs.status': '状态',
    'runs.workflow': '工作流',
    'runs.createdAt': '创建时间',
    'runs.duration': '耗时',
    'runs.score': '评分',
    'runs.resume': '继续',
    'runs.viewDetail': '查看',
    'runDetail.title': '运行详情',
    'runDetail.steps': '步骤',
    'runDetail.output': '输出',
    'runDetail.logs': '日志',
    'runDetail.eval': '评估',
    'runDetail.gate': 'Gate',
    'runDetail.streaming': '流式输出中...',
    'runDetail.approve': '通过',
    'runDetail.reject': '拒绝',
    'runDetail.edit': '编辑并继续',
    'runDetail.gateWaiting': '等待 Gate 决策',
    'runDetail.tokenUsage': 'Token 使用量',
    'runDetail.promptTokens': '提示词',
    'runDetail.completionTokens': '补全',
    'runDetail.totalTokens': '总计',
    'runDetail.eventsComingSoon': '事件日志即将推出...',
    'runDetail.evalComingSoon': '评估功能即将推出...',
    'runDetail.editPlaceholder': '如有需要请编辑输出...',
    'runDetail.runId': '运行 ID',
    'settings.title': '设置',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.themeLight': '浅色',
    'settings.themeDark': '深色',
    'settings.themeSystem': '跟随系统',
    'settings.projectPath': '项目路径',
    'settings.apiKey': 'API Key',
    'settings.baseUrl': 'Base URL',
    'settings.status': '状态',
    'settings.environment': '环境',
    'settings.themeComingSoon': '主题切换即将推出...',
    'status.pending': '等待中',
    'status.running': '运行中',
    'status.completed': '已完成',
    'status.failed': '失败',
    'status.interrupted': '已中断',
    'status.gate_waiting': '待审批',
    'status.skipped': '已跳过',
    'common.loading': '加载中...',
    'common.error': '发生错误',
    'common.retry': '重试',
    'common.close': '关闭',
    'common.save': '保存',
    'common.cancel': '取消',
  },
};

function getNestedValue(obj: Record<string, string>, path: string): string {
  return obj[path] ?? path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('locale');
    return (saved === 'en' || saved === 'zh-CN' ? saved : 'en') as Locale;
  });

  useEffect(() => {
    localStorage.setItem('locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: string) => getNestedValue(translations[locale], key) || key;

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
