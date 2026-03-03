'use client';

import { useEffect, useRef, useState } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  trend?: { value: number; label: string };
  icon?: React.ReactNode;
  color?: string;
  sparklineData?: number[];
}

function AnimatedNumber({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setDisplay(value);
      prevRef.current = value;
    }
  }, [value]);

  return <span>{display}</span>;
}

function MiniSparkline({ data, color = '#3B82F6' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 28;
  const w = 80;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function StatCard({ label, value, prefix, suffix, trend, icon, color = 'blue', sparklineData }: StatCardProps) {
  const trendColor = trend
    ? trend.value > 0
      ? 'text-red-400'
      : trend.value < 0
      ? 'text-green-400'
      : 'text-navy-400'
    : '';

  return (
    <div className="card-hover p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="stat-label">{label}</span>
        {icon && <div className="text-navy-400">{icon}</div>}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="stat-value text-white">
            {prefix}
            <AnimatedNumber value={value} />
            {suffix && <span className="text-lg text-navy-300 ml-1">{suffix}</span>}
          </p>
          {trend && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${trendColor}`}>
              {trend.value > 0 ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              ) : trend.value < 0 ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 4.5 15 15m0 0V8.25m0 11.25H8.25" />
                </svg>
              ) : null}
              {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {sparklineData && <MiniSparkline data={sparklineData} color={`var(--color-accent-${color}, #3B82F6)`} />}
      </div>
    </div>
  );
}
