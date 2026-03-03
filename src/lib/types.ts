export interface DailyUsageRecord {
  date: string; // YYYY-MM-DD
  models: ModelUsage[];
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export interface ModelUsage {
  model: string;
  project?: string;
  user?: string;
  tokensIn: number;
  tokensOut: number;
  requests: number;
  cost: number;
}

export interface DailyCostRecord {
  date: string; // YYYY-MM-DD
  totalCost: number;
  breakdown: { model: string; cost: number }[];
}

export interface CreditBalance {
  totalGranted: number;
  totalUsed: number;
  remaining: number;
  lastUpdated: string;
}

export interface UsageSummary {
  totalSpent: number;
  remaining: number;
  dailyAvgBurn: number;
  weeklyAvgBurn: number;
  monthlyAvgBurn: number;
  daysOfData: number;
  estimatedExhaustionDate: string | null;
  topModels: { model: string; cost: number; percentage: number }[];
  dailyTrend: { date: string; cost: number }[];
  burnTrend: 'increasing' | 'decreasing' | 'stable';
  burnTrendPct: number;
}

export interface ForecastResult {
  method: 'linear' | 'weighted' | 'scenario';
  exhaustionDate: string | null;
  projectedDailyCost: number;
  confidence: { low: string | null; high: string | null };
  projectedData: { date: string; cost: number; cumulative: number }[];
}

export interface ScenarioParams {
  growthRate: number; // percentage monthly growth
  modelMixShift: number; // % shift toward expensive models
  additionalSpend: number; // additional daily spend
  budgetCap: number; // monthly budget cap ($)
}

export interface AlertThreshold {
  id: string;
  metric: 'daily_spend' | 'weekly_spend' | 'remaining_pct' | 'monthly_spend';
  operator: 'gt' | 'lt';
  value: number;
  enabled: boolean;
}

export interface SyncStatus {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  error?: string;
  recordCount: number;
}

export interface MonthlyBurnSummary {
  month: string; // YYYY-MM
  totalCost: number;
  avgDailyCost: number;
  daysActive: number;
  topModel: string;
  topModelCost: number;
  cumulativeTotal: number;
  remainingCredits: number;
}
