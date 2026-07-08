'use client';

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export interface SparklineProps {
  data: number[];
  /** Color of the line. Defaults to emerald-400 (#34d399). */
  color?: string;
  /** Width in px (height = 28). */
  width?: number;
  height?: number;
  className?: string;
  /** Whether to fill the area under the line. */
  area?: boolean;
}

/**
 * Minimal inline trend chart for stat cards / agent cards.
 */
export function Sparkline({
  data,
  color = '#34d399',
  width = 80,
  height = 28,
  className,
  area = false,
}: SparklineProps) {
  const chartData = useMemo(() => data.map((v, i) => ({ i, v })), [data]);

  if (data.length < 2) {
    return <div className={cn('text-slate-600 text-xs', className)} style={{ width, height }} />;
  }

  return (
    <div className={cn('flex items-center', className)} style={{ width, height }}>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Tooltip
            contentStyle={{
              background: 'rgb(15 23 42)',
              border: '1px solid rgb(51 65 85)',
              borderRadius: 6,
              fontSize: 11,
              color: '#e2e8f0',
              padding: '4px 8px',
            }}
            labelStyle={{ display: 'none' }}
            formatter={(value: number) => [value.toFixed(3), '']}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
