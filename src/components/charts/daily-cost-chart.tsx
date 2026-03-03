'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';

interface DailyCostChartProps {
  data: { date: string; cost: number }[];
  height?: number;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function DailyCostChart({ data, height = 240 }: DailyCostChartProps) {
  return (
    <div className="card-hover p-5">
      <h3 className="stat-label mb-4">Daily Spend</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dailyCostGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2C4F" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#717F9A', fontSize: 10 }}
              tickFormatter={(d) => format(parseISO(d), 'MMM d')}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#717F9A', fontSize: 10 }}
              tickFormatter={formatMoney}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2C4F',
                border: '1px solid #31466C',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#E8EBF0',
              }}
              formatter={(value: number) => [formatMoney(value), 'Cost']}
              labelFormatter={(d) => format(parseISO(d as string), 'MMM d, yyyy')}
            />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#dailyCostGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
