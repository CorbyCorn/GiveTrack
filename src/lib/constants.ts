export const TOTAL_CREDIT_GRANT = Number(process.env.TOTAL_CREDIT_GRANT) || 40_000_000;
export const GRANT_DATE = '2024-12-01';
export const AUTH_COOKIE_NAME = 'gt-auth-token';
export const AUTH_SECRET = process.env.AUTH_SECRET || 'default-dev-secret-change-me-32ch';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
export const OPENAI_ADMIN_KEY = process.env.OPENAI_ADMIN_KEY || '';
export const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID || '';
export const CRON_SECRET = process.env.CRON_SECRET || '';

export const REDIS_KEYS = {
  DAILY_COSTS: 'costs:daily',
  DAILY_USAGE: 'usage:daily',
  CREDIT_BALANCE: 'credits:balance',
  LAST_SYNC: 'sync:last',
  SETTINGS: 'settings',
  ALERT_THRESHOLDS: 'alerts:thresholds',
} as const;

export const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Usage', href: '/dashboard/usage', icon: 'BarChart3' },
  { label: 'Forecast', href: '/dashboard/forecast', icon: 'TrendingUp' },
  { label: 'Accounting', href: '/dashboard/accounting', icon: 'FileText' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
] as const;

export const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#3B82F6',
  'gpt-4o-mini': '#06B6D4',
  'gpt-4-turbo': '#8B5CF6',
  'gpt-4': '#A855F7',
  'gpt-3.5-turbo': '#10B981',
  'o1-preview': '#F59E0B',
  'o1-mini': '#F97316',
  'o1': '#EF4444',
  'o3-mini': '#EC4899',
  'dall-e-3': '#14B8A6',
  'tts-1': '#6366F1',
  'whisper-1': '#84CC16',
  default: '#6B7280',
};
