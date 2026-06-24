'use client'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatNumber } from '@/utils/format'

interface DataPoint {
  label: string
  입고: number
  출고: number
}

export default function StockAreaChart({ data }: { data: DataPoint[] }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const gridColor     = isDark ? 'var(--color-line)' : 'var(--color-line)'
  const tickColor     = isDark ? 'var(--color-text-muted)' : 'var(--color-text-muted)'
  const tooltipBg     = 'var(--color-surface)'
  const tooltipBorder = 'var(--color-line)'
  const tooltipText   = 'var(--color-text)'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--color-success)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--color-danger)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: tickColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: tickColor }}
          tickFormatter={(value) => formatNumber(value)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${tooltipBorder}`,
            boxShadow: 'var(--shadow-card)',
            fontSize: '12px',
            backgroundColor: tooltipBg,
            color: tooltipText,
          }}
          formatter={(value) => formatNumber(value as number)}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: tickColor }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="입고"
          stroke="var(--color-success)"
          strokeWidth={2}
          fill="url(#gradIn)"
          dot={{ r: 3, fill: 'var(--color-success)' }}
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="출고"
          stroke="var(--color-danger)"
          strokeWidth={2}
          fill="url(#gradOut)"
          dot={{ r: 3, fill: 'var(--color-danger)' }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
