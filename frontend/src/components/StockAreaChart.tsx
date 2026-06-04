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

  const gridColor     = isDark ? '#1f2937' : '#e5e7eb'
  const tickColor     = isDark ? '#94a3b8' : '#64748b'
  const tooltipBg     = isDark ? '#0f172a' : '#ffffff'
  const tooltipBorder = isDark ? '#334155' : '#e5e7eb'
  const tooltipText   = isDark ? '#e5e7eb' : '#111827'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}    />
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
            borderRadius: '12px',
            border: `1px solid ${tooltipBorder}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
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
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#gradIn)"
          dot={{ r: 3, fill: '#10b981' }}
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="출고"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#gradOut)"
          dot={{ r: 3, fill: '#f43f5e' }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
