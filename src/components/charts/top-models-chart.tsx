'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MODEL_COLORS } from '@/lib/constants';

interface TopModelsChartProps {
  data: { model: string; cost: number; percentage: number }[];
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function TopModelsChart({ data }: TopModelsChartProps) {
  const chartData = data.slice(0, 8).map((d) => ({
    name: d.model.replace('gpt-', '').replace('-turbo', '-t'),
    cost: d.cost,
    fullName: d.model,
    pct: d.percentage,
  }));

  return (
    <div className="card-hover p-5">
      <h3 className="stat-label mb-4">Top Models by Spend</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fill: '#717F9A', fontSize: 11 }} tickFormatter={formatMoney} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#9BA5B8', fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2C4F',
                border: '1px solid #31466C',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#E8EBF0',
              }}
              formatter={(value: number) => [formatMoney(value), 'Cost']}
              labelFormatter={(label: string) => {
                const item = chartData.find((d) => d.name === label);
                return item?.fullName || label;
              }}
            />
            <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry) => (
                <Cell key={entry.fullName} fill={MODEL_COLORS[entry.fullName] || MODEL_COLORS.default} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
