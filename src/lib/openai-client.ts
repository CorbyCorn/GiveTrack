import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import { OPENAI_ADMIN_KEY, OPENAI_ORG_ID, TOTAL_CREDIT_GRANT } from './constants';
import type { DailyCostRecord, DailyUsageRecord, CreditBalance, ModelUsage } from './types';

const BASE_URL = 'https://api.openai.com';

async function fetchOpenAI(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${OPENAI_ADMIN_KEY}`,
    'Content-Type': 'application/json',
  };
  if (OPENAI_ORG_ID) {
    headers['OpenAI-Organization'] = OPENAI_ORG_ID;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }
  return res.json();
}

interface CostBucket {
  object: string;
  amount: { value: number; currency: string };
  line_item?: string;
  project_id?: string;
}

interface CostResult {
  object: string;
  amount: { value: number; currency: string };
  results?: CostBucket[];
}

interface CostPage {
  object: string;
  data: CostResult[];
  has_more: boolean;
  next_page?: string;
}

export async function fetchDailyCosts(startDate: string, endDate: string): Promise<DailyCostRecord[]> {
  const start = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
  const end = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);

  const costMap: Record<string, { totalCost: number; breakdown: Record<string, number> }> = {};
  let page: string | undefined;

  do {
    const params: Record<string, string> = {
      start_time: start.toString(),
      end_time: end.toString(),
      bucket_width: '1d',
      group_by: 'line_item',
    };
    if (page) params.page = page;

    const data = (await fetchOpenAI('/v1/organization/costs', params)) as CostPage;

    for (const result of data.data || []) {
      const resultAmount = result.amount?.value || 0;
      if (resultAmount === 0 && !result.results?.length) continue;

      for (const bucket of result.results || []) {
        const model = bucket.line_item || 'unknown';
        const cost = bucket.amount?.value || 0;

        // Group by day based on position in data array
        const dayIndex = (data.data || []).indexOf(result);
        const dayDate = format(new Date((start + dayIndex * 86400) * 1000), 'yyyy-MM-dd');

        if (!costMap[dayDate]) {
          costMap[dayDate] = { totalCost: 0, breakdown: {} };
        }
        costMap[dayDate].totalCost += cost;
        costMap[dayDate].breakdown[model] = (costMap[dayDate].breakdown[model] || 0) + cost;
      }
    }

    page = data.has_more ? data.next_page : undefined;
  } while (page);

  return Object.entries(costMap)
    .map(([date, data]) => ({
      date,
      totalCost: Math.round(data.totalCost * 100) / 100,
      breakdown: Object.entries(data.breakdown).map(([model, cost]) => ({
        model,
        cost: Math.round(cost * 100) / 100,
      })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface UsageBucket {
  input_tokens: number;
  output_tokens: number;
  num_model_requests: number;
  project_id?: string;
  user_id?: string;
  model?: string;
}

interface UsagePage {
  object: string;
  data: { results: UsageBucket[] }[];
  has_more: boolean;
  next_page?: string;
}

export async function fetchDailyUsage(startDate: string, endDate: string): Promise<DailyUsageRecord[]> {
  const start = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
  const end = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);

  const usageMap: Record<string, ModelUsage[]> = {};
  let page: string | undefined;

  do {
    const params: Record<string, string> = {
      start_time: start.toString(),
      end_time: end.toString(),
      bucket_width: '1d',
      group_by: 'model',
    };
    if (page) params.page = page;

    let data: UsagePage;
    try {
      data = (await fetchOpenAI('/v1/organization/usage/completions', params)) as UsagePage;
    } catch {
      break;
    }

    for (let i = 0; i < (data.data || []).length; i++) {
      const dayData = data.data[i];
      const dayDate = format(new Date((start + i * 86400) * 1000), 'yyyy-MM-dd');

      if (!usageMap[dayDate]) usageMap[dayDate] = [];

      for (const bucket of dayData.results || []) {
        usageMap[dayDate].push({
          model: bucket.model || 'unknown',
          project: bucket.project_id,
          user: bucket.user_id,
          tokensIn: bucket.input_tokens || 0,
          tokensOut: bucket.output_tokens || 0,
          requests: bucket.num_model_requests || 0,
          cost: 0, // Cost is calculated from the costs endpoint
        });
      }
    }

    page = data.has_more ? data.next_page : undefined;
  } while (page);

  return Object.entries(usageMap)
    .map(([date, models]) => ({
      date,
      models,
      totalCost: 0,
      totalTokensIn: models.reduce((s, m) => s + m.tokensIn, 0),
      totalTokensOut: models.reduce((s, m) => s + m.tokensOut, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface CreditGrant {
  object: string;
  data: {
    object: string;
    id: string;
    grant_amount: number;
    used_amount: number;
    effective_at: number;
    expires_at: number | null;
  }[];
  has_more: boolean;
}

export async function fetchCreditBalance(): Promise<CreditBalance> {
  try {
    const data = (await fetchOpenAI('/v1/dashboard/billing/credit_grants')) as CreditGrant;

    let totalGranted = 0;
    let totalUsed = 0;

    for (const grant of data.data || []) {
      totalGranted += grant.grant_amount || 0;
      totalUsed += grant.used_amount || 0;
    }

    return {
      totalGranted: totalGranted || TOTAL_CREDIT_GRANT,
      totalUsed,
      remaining: (totalGranted || TOTAL_CREDIT_GRANT) - totalUsed,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    // Fallback: return grant total without usage data
    return {
      totalGranted: TOTAL_CREDIT_GRANT,
      totalUsed: 0,
      remaining: TOTAL_CREDIT_GRANT,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export async function syncAllData(daysBack: number = 90) {
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');

  const [costs, usage, credits] = await Promise.all([
    fetchDailyCosts(startDate, endDate),
    fetchDailyUsage(startDate, endDate),
    fetchCreditBalance(),
  ]);

  // Merge cost data into usage records
  const costByDate = new Map(costs.map((c) => [c.date, c]));
  const mergedUsage = usage.map((u) => {
    const costRecord = costByDate.get(u.date);
    if (costRecord) {
      u.totalCost = costRecord.totalCost;
      // Distribute costs across models proportionally by tokens
      const totalTokens = u.models.reduce((s, m) => s + m.tokensIn + m.tokensOut, 0);
      if (totalTokens > 0) {
        for (const model of u.models) {
          const modelTokens = model.tokensIn + model.tokensOut;
          model.cost = (modelTokens / totalTokens) * costRecord.totalCost;
        }
      }
    }
    return u;
  });

  // If credit endpoint didn't return usage, calculate from costs
  if (credits.totalUsed === 0 && costs.length > 0) {
    credits.totalUsed = costs.reduce((s, c) => s + c.totalCost, 0);
    credits.remaining = credits.totalGranted - credits.totalUsed;
  }

  return { costs, usage: mergedUsage, credits };
}
