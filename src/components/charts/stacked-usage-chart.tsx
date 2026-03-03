'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { MODEL_COLORS } from '@/lib/constants';

interface StackedUsageChartProps {
  data: { date: string; [model: string]: number | string }[];
  models: string[];
  height?: number;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function StackedUsageChart({ data, models, height = 360 }: StackedUsageChartProps) {
  return (
    <div className="card-hover p-5">
      <h3 className="stat-label mb-4">Usage Over Time by Model</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              {models.map((model) => (
                <linearGradient key={model} id={`grad-${model.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={MODEL_COLORS[model] || MODEL_COLORS.default} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={MODEL_COLORS[model] || MODEL_COLORS.default} stopOpacity={0.05} />
                </linearGradient>
              ))}
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
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2C4F',
                border: '1px solid #31466C',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#E8EBF0',
              }}
              formatter={(value: number, name: string) => [formatMoney(value), name]}
              labelFormatter={(d) => format(parseISO(d as string), 'MMM d, yyyy')}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: '#9BA5B8' }}
              iconType="circle"
              iconSize={8}
            />
            {models.map((model) => (
              <Area
                key={model}
                type="monotone"
                dataKey={model}
                stackId="1"
                stroke={MODEL_COLORS[model] || MODEL_COLORS.default}
                fill={`url(#grad-${model.replace(/[^a-z0-9]/gi, '')})`}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
