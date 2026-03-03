import { NextResponse } from 'next/server';
import { getDailyCosts, getCreditBalance } from '@/lib/redis';
import { TOTAL_CREDIT_GRANT } from '@/lib/constants';
import { differenceInDays, addDays, format } from 'date-fns';
import type { UsageSummary } from '@/lib/types';

export async function GET() {
  try {
    const costs = await getDailyCosts();
    const balance = await getCreditBalance();

    const totalSpent = costs.reduce((s, c) => s + c.totalCost, 0);
    const remaining = balance ? balance.remaining : TOTAL_CREDIT_GRANT - totalSpent;

    const daysOfData = costs.length || 1;
    const dailyAvgBurn = totalSpent / daysOfData;
    const weeklyAvgBurn = dailyAvgBurn * 7;
    const monthlyAvgBurn = dailyAvgBurn * 30;

    // Exhaustion date
    let estimatedExhaustionDate: string | null = null;
    if (dailyAvgBurn > 0) {
      const daysRemaining = remaining / dailyAvgBurn;
      estimatedExhaustionDate = format(addDays(new Date(), daysRemaining), 'yyyy-MM-dd');
    }

    // Top models
    const modelCosts: Record<string, number> = {};
    for (const day of costs) {
      for (const item of day.breakdown) {
        modelCosts[item.model] = (modelCosts[item.model] || 0) + item.cost;
      }
    }
    const topModels = Object.entries(modelCosts)
      .map(([model, cost]) => ({
        model,
        cost: Math.round(cost * 100) / 100,
        percentage: totalSpent > 0 ? Math.round((cost / totalSpent) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    // Daily trend
    const dailyTrend = costs.map((c) => ({ date: c.date, cost: c.totalCost }));

    // Burn trend (compare last 7 days to previous 7 days)
    let burnTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let burnTrendPct = 0;
    if (costs.length >= 14) {
      const recent7 = costs.slice(-7).reduce((s, c) => s + c.totalCost, 0);
      const prev7 = costs.slice(-14, -7).reduce((s, c) => s + c.totalCost, 0);
      if (prev7 > 0) {
        burnTrendPct = Math.round(((recent7 - prev7) / prev7) * 10000) / 100;
        burnTrend = burnTrendPct > 5 ? 'increasing' : burnTrendPct < -5 ? 'decreasing' : 'stable';
      }
    }

    const summary: UsageSummary = {
      totalSpent: Math.round(totalSpent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      dailyAvgBurn: Math.round(dailyAvgBurn * 100) / 100,
      weeklyAvgBurn: Math.round(weeklyAvgBurn * 100) / 100,
      monthlyAvgBurn: Math.round(monthlyAvgBurn * 100) / 100,
      daysOfData,
      estimatedExhaustionDate,
      topModels,
      dailyTrend,
      burnTrend,
      burnTrendPct,
    };

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
