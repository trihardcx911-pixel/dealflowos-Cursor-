import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type WeeklyActivityChartProps = {
  weeklyData: { day: string; count: number }[]
}

export function WeeklyActivityChart({ weeklyData }: WeeklyActivityChartProps) {
  return (
    <div className="dashboard-card kpi-chart-card">
      <p className="text-sm uppercase tracking-widest text-white/50 mb-4">Weekly Lead Activity</p>
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={weeklyData}
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
          <XAxis 
            dataKey="day" 
            stroke="rgba(255, 255, 255, 0.4)"
            style={{ fontSize: '11px' }}
            tick={{ fill: 'rgba(255, 255, 255, 0.5)' }}
          />
          <YAxis 
            stroke="rgba(255, 255, 255, 0.4)"
            style={{ fontSize: '11px' }}
            tick={{ fill: 'rgba(255, 255, 255, 0.5)' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(11, 11, 15, 0.95)', 
              border: '1px solid rgba(255, 0, 80, 0.3)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px'
            }}
            cursor={{ fill: 'rgba(255, 0, 80, 0.1)' }}
          />
          <Bar 
            dataKey="count" 
            fill="rgba(255, 0, 80, 0.4)"
            stroke="rgba(255, 0, 80, 0.35)"
            strokeWidth={1}
            radius={[6, 6, 0, 0]}
            style={{
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

