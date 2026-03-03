import { addDays, format, differenceInDays, parseISO } from 'date-fns';
import { TOTAL_CREDIT_GRANT } from './constants';
import type { ForecastResult, ScenarioParams, DailyCostRecord } from './types';

// ---- LINEAR REGRESSION ----
function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (const { x, y } of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const ssTot = sumYY - (sumY * sumY) / n;
  const ssRes = data.reduce((s, { x, y }) => s + Math.pow(y - (slope * x + intercept), 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

export function linearForecast(costs: DailyCostRecord[], totalCredits: number = TOTAL_CREDIT_GRANT): ForecastResult {
  const dataPoints = costs.map((c, i) => ({ x: i, y: c.totalCost }));
  const { slope, intercept, r2 } = linearRegression(dataPoints);

  const totalSpent = costs.reduce((s, c) => s + c.totalCost, 0);
  const remaining = totalCredits - totalSpent;
  const avgDailyCost = slope * (costs.length - 1) + intercept;

  const projectedData: { date: string; cost: number; cumulative: number }[] = [];
  let cumulative = totalSpent;
  let exhaustionDate: string | null = null;
  const lastDate = costs.length > 0 ? parseISO(costs[costs.length - 1].date) : new Date();

  for (let i = 1; i <= 365 * 3; i++) {
    const dayCost = Math.max(0, slope * (costs.length - 1 + i) + intercept);
    cumulative += dayCost;
    const date = format(addDays(lastDate, i), 'yyyy-MM-dd');

    if (i <= 365) {
      projectedData.push({ date, cost: dayCost, cumulative });
    }

    if (!exhaustionDate && cumulative >= totalCredits) {
      exhaustionDate = date;
    }
  }

  // Confidence: +/- based on r2
  const confidenceFactor = Math.max(0.1, 1 - r2);
  let confLow: string | null = null;
  let confHigh: string | null = null;

  if (exhaustionDate && avgDailyCost > 0) {
    const daysToExhaustion = remaining / avgDailyCost;
    const lowDays = daysToExhaustion * (1 - confidenceFactor * 0.5);
    const highDays = daysToExhaustion * (1 + confidenceFactor * 0.5);
    confLow = format(addDays(new Date(), lowDays), 'yyyy-MM-dd');
    confHigh = format(addDays(new Date(), highDays), 'yyyy-MM-dd');
  }

  return {
    method: 'linear',
    exhaustionDate,
    projectedDailyCost: Math.round(avgDailyCost * 100) / 100,
    confidence: { low: confLow, high: confHigh },
    projectedData,
  };
}

// ---- WEIGHTED / SEASONAL ----
export function weightedForecast(costs: DailyCostRecord[], totalCredits: number = TOTAL_CREDIT_GRANT): ForecastResult {
  if (costs.length < 7) return linearForecast(costs, totalCredits);

  // Day-of-week factors
  const dayFactors: number[] = Array(7).fill(0);
  const dayCounts: number[] = Array(7).fill(0);
  for (const c of costs) {
    const dow = parseISO(c.date).getDay();
    dayFactors[dow] += c.totalCost;
    dayCounts[dow]++;
  }
  const avgCost = costs.reduce((s, c) => s + c.totalCost, 0) / costs.length;
  for (let i = 0; i < 7; i++) {
    dayFactors[i] = dayCounts[i] > 0 ? dayFactors[i] / dayCounts[i] / (avgCost || 1) : 1;
  }

  // Exponential smoothing (alpha = 0.3)
  const alpha = 0.3;
  let smoothed = costs[0].totalCost;
  for (const c of costs) {
    smoothed = alpha * c.totalCost + (1 - alpha) * smoothed;
  }

  // Growth detection: compare first half vs second half
  const mid = Math.floor(costs.length / 2);
  const firstHalf = costs.slice(0, mid).reduce((s, c) => s + c.totalCost, 0) / mid;
  const secondHalf = costs.slice(mid).reduce((s, c) => s + c.totalCost, 0) / (costs.length - mid);
  const growthRate = firstHalf > 0 ? (secondHalf - firstHalf) / firstHalf : 0;
  const dailyGrowth = Math.pow(1 + growthRate, 1 / costs.length);

  const totalSpent = costs.reduce((s, c) => s + c.totalCost, 0);
  const lastDate = parseISO(costs[costs.length - 1].date);

  const projectedData: { date: string; cost: number; cumulative: number }[] = [];
  let cumulative = totalSpent;
  let exhaustionDate: string | null = null;
  let currentSmoothed = smoothed;

  for (let i = 1; i <= 365 * 3; i++) {
    const futureDate = addDays(lastDate, i);
    const dow = futureDate.getDay();
    currentSmoothed *= dailyGrowth;
    const dayCost = Math.max(0, currentSmoothed * dayFactors[dow]);
    cumulative += dayCost;

    if (i <= 365) {
      projectedData.push({
        date: format(futureDate, 'yyyy-MM-dd'),
        cost: Math.round(dayCost * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      });
    }

    if (!exhaustionDate && cumulative >= totalCredits) {
      exhaustionDate = format(futureDate, 'yyyy-MM-dd');
    }
  }

  const remaining = totalCredits - totalSpent;
  const confMargin = 0.25;
  let confLow: string | null = null;
  let confHigh: string | null = null;
  if (smoothed > 0) {
    const daysToExhaustion = remaining / smoothed;
    confLow = format(addDays(new Date(), daysToExhaustion * (1 - confMargin)), 'yyyy-MM-dd');
    confHigh = format(addDays(new Date(), daysToExhaustion * (1 + confMargin)), 'yyyy-MM-dd');
  }

  return {
    method: 'weighted',
    exhaustionDate,
    projectedDailyCost: Math.round(smoothed * 100) / 100,
    confidence: { low: confLow, high: confHigh },
    projectedData,
  };
}

// ---- SCENARIO ----
export function scenarioForecast(
  costs: DailyCostRecord[],
  params: ScenarioParams,
  totalCredits: number = TOTAL_CREDIT_GRANT
): ForecastResult {
  const totalSpent = costs.reduce((s, c) => s + c.totalCost, 0);
  const avgDaily = costs.length > 0 ? totalSpent / costs.length : 0;

  // Model mix shift: more expensive = higher cost multiplier
  const mixMultiplier = 1 + params.modelMixShift / 100;

  const lastDate = costs.length > 0 ? parseISO(costs[costs.length - 1].date) : new Date();
  const monthlyGrowthRate = 1 + params.growthRate / 100;
  const dailyGrowthRate = Math.pow(monthlyGrowthRate, 1 / 30);

  const projectedData: { date: string; cost: number; cumulative: number }[] = [];
  let cumulative = totalSpent;
  let exhaustionDate: string | null = null;
  let currentDaily = avgDaily * mixMultiplier;
  let monthlySpent = 0;
  let currentMonth = -1;

  for (let i = 1; i <= 365 * 3; i++) {
    const futureDate = addDays(lastDate, i);
    const month = futureDate.getMonth();

    if (month !== currentMonth) {
      currentMonth = month;
      monthlySpent = 0;
    }

    currentDaily *= dailyGrowthRate;
    let dayCost = currentDaily + params.additionalSpend;

    // Apply budget cap
    if (params.budgetCap > 0 && monthlySpent + dayCost > params.budgetCap) {
      dayCost = Math.max(0, params.budgetCap - monthlySpent);
    }

    monthlySpent += dayCost;
    cumulative += dayCost;

    if (i <= 365) {
      projectedData.push({
        date: format(futureDate, 'yyyy-MM-dd'),
        cost: Math.round(dayCost * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      });
    }

    if (!exhaustionDate && cumulative >= totalCredits) {
      exhaustionDate = format(futureDate, 'yyyy-MM-dd');
    }
  }

  return {
    method: 'scenario',
    exhaustionDate,
    projectedDailyCost: Math.round(currentDaily * 100) / 100,
    confidence: { low: null, high: null },
    projectedData,
  };
}
