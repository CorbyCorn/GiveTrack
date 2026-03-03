'use client';

import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { ForecastResult, DailyCostRecord } from '@/lib/types';

interface ForecastChartProps {
  historicalData: DailyCostRecord[];
  forecasts: ForecastResult[];
  totalCredits: number;
  height?: number;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const FORECAST_COLORS = {
  linear: '#3B82F6',
  weighted: '#8B5CF6',
  scenario: '#F59E0B',
};

export default function ForecastChart({ historicalData, forecasts, totalCredits, height = 400 }: ForecastChartProps) {
  // Build combined dataset
  let cumulative = 0;
  const historicalPoints = historicalData.map((d) => {
    cumulative += d.totalCost;
    return { date: d.date, historical: cumulative };
  });

  // Merge forecast data
  const forecastMaps: Record<string, Record<string, number>> = {};
  for (const f of forecasts) {
    forecastMaps[f.method] = {};
    for (const p of f.projectedData) {
      forecastMaps[f.method][p.date] = p.cumulative;
    }
  }

  // Collect all unique dates
  const allDates = new Set<string>();
  for (const p of historicalPoints) allDates.add(p.date);
  for (const f of forecasts) {
    for (const p of f.projectedData.slice(0, 180)) allDates.add(p.date);
  }

  const sortedDates = Array.from(allDates).sort();
  const chartData = sortedDates.map((date) => {
    const hist = historicalPoints.find((h) => h.date === date);
    const row: Record<string, number | string | undefined> = { date };
    if (hist) row.historical = hist.historical;
    for (const method of Object.keys(forecastMaps)) {
      if (forecastMaps[method][date] !== undefined) {
        row[method] = forecastMaps[method][date];
      }
    }
    return row;
  });

  return (
    <div className="card-hover p-5">
      <h3 className="stat-label mb-4">Cumulative Spend vs. Credit Grant</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2C4F" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#717F9A', fontSize: 10 }}
              tickFormatter={(d) => {
                try { return format(parseISO(d), 'MMM yyyy'); } catch { return d; }
              }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#717F9A', fontSize: 10 }}
              tickFormatter={formatMoney}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2C4F',
                border: '1px solid #31466C',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#E8EBF0',
              }}
              formatter={(value: number, name: string) => [formatMoney(value), name === 'historical' ? 'Actual' : name]}
              labelFormatter={(d) => {
                try { return format(parseISO(d as string), 'MMM d, yyyy'); } catch { return d as string; }
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: '#9BA5B8' }}
              formatter={(value) => (value === 'historical' ? 'Actual Spend' : `${value} forecast`)}
            />

            <ReferenceLine
              y={totalCredits}
              stroke="#EF4444"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{ value: `$${(totalCredits / 1e6).toFixed(0)}M Grant`, fill: '#EF4444', fontSize: 11, position: 'right' }}
            />

            <Area
              type="monotone"
              dataKey="historical"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#histGrad)"
              name="historical"
              dot={false}
            />

            {forecasts.map((f) => (
              <Line
                key={f.method}
                type="monotone"
                dataKey={f.method}
                stroke={FORECAST_COLORS[f.method] || '#6B7280'}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                name={f.method}
                connectNulls={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
