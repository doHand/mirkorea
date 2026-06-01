'use client'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  label: string
  입고: number
  출고: number
}

export default function StockAreaChart({ data }: { data: DataPoint[] }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const gridColor    = isDark ? '#374151' : '#f3f4f6'
  const tickColor    = isDark ? '#6b7280' : '#9ca3af'
  const tooltipBg    = isDark ? '#1f2937' : '#ffffff'
  const tooltipBorder = isDark ? '#374151' : '#f3f4f6'
  const tooltipText  = isDark ? '#e5e7eb' : '#374151'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#e84c2b" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#e84c2b" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
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
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: tickColor }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="입고"
          stroke="#e84c2b"
          strokeWidth={2}
          fill="url(#gradIn)"
          dot={{ r: 3, fill: '#e84c2b' }}
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="출고"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#gradOut)"
          dot={{ r: 3, fill: '#8b5cf6' }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
