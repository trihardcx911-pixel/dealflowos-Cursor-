import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

type LeadSourcePieProps = {
  sourceData: { name: string; value: number }[]
}

const PIE_COLORS = [
  'rgba(255, 0, 80, 0.5)',
  'rgba(255, 39, 100, 0.5)',
  'rgba(255, 78, 120, 0.5)',
  'rgba(255, 117, 140, 0.5)',
  'rgba(255, 156, 160, 0.5)',
]

export function LeadSourcePie({ sourceData }: LeadSourcePieProps) {
  return (
    <div className="dashboard-card kpi-chart-card">
      <p className="text-sm uppercase tracking-widest text-white/50 mb-4">Lead Source Breakdown</p>
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={sourceData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={90}
            fill="#8884d8"
            dataKey="value"
            stroke="rgba(255, 0, 80, 0.4)"
            strokeWidth={1.5}
            style={{
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {sourceData.map((_entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={PIE_COLORS[index % PIE_COLORS.length]}
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(255, 0, 80, 0.3))',
                }}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(11, 11, 15, 0.95)', 
              border: '1px solid rgba(255, 0, 80, 0.3)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

