import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { get } from '../api'
import { useToast } from '../useToast'
import BackToDashboard from '../components/BackToDashboard'

type KpiData = {
  totalLeads: number
  activeLeads: number
  conversionRate: number
  assignments: number
  contractsInEscrow: number
  contactRate: number
  qualifiedLeads: number
  monthlyProfit: number
  charts: {
    leadsOverTime: Array<{ month: string; leads: number }>
    leadTypes: Array<{ name: string; value: number }>
  }
}

// Mock data for 30-day hero chart
const heroChartData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  leads: Math.floor(Math.random() * 20) + 10 + Math.sin(i / 5) * 5,
}))

// Mock data for weekly activity
const weeklyActivityMock = [
  { day: 'Sun', count: 12 },
  { day: 'Mon', count: 18 },
  { day: 'Tue', count: 24 },
  { day: 'Wed', count: 19 },
  { day: 'Thu', count: 22 },
  { day: 'Fri', count: 28 },
  { day: 'Sat', count: 15 },
]

// Mock data for lead source breakdown
const leadSourceMock = [
  { name: 'Cold Call', value: 35 },
  { name: 'SMS', value: 28 },
  { name: 'PPC', value: 22 },
  { name: 'Driving for Dollars', value: 10 },
  { name: 'Referral', value: 5 },
]

const PIE_COLORS = [
  'rgba(255, 0, 80, 0.6)',
  'rgba(255, 39, 100, 0.6)',
  'rgba(255, 78, 120, 0.6)',
  'rgba(255, 117, 140, 0.6)',
  'rgba(255, 156, 160, 0.6)',
]

export default function KpisPage() {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const { notify } = useToast()

  useEffect(() => {
    async function fetchKpis() {
      try {
        const res = await get<KpiData>('/kpis')
        const mappedData = {
          ...res,
          qualifiedLeads: res.qualifiedLeads ?? res.monthlyNewLeads ?? 0,
        }
        setData(mappedData)
      } catch (e: any) {
        const msg = e?.error?.message || e?.message || 'Unable to load KPIs'
        notify('error', msg)
      } finally {
        setLoading(false)
      }
    }
    fetchKpis()
  }, [notify])

  if (loading) {
    return (
      <>
        <BackToDashboard />
        <header className="space-y-2 mb-6" style={{ paddingLeft: '3rem', paddingRight: '3rem' }}>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
          <h1 className="text-xl font-semibold tracking-tight text-white">Key Performance Indicators</h1>
        </header>
        <div className="dashboard-grid-container kpi-grid">
          <div className="dashboard-card">
            <p className="text-sm text-white/60">Loading...</p>
          </div>
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <BackToDashboard />
        <header className="space-y-2 mb-6" style={{ paddingLeft: '3rem', paddingRight: '3rem' }}>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
          <h1 className="text-xl font-semibold tracking-tight text-white">Key Performance Indicators</h1>
        </header>
        <div className="dashboard-grid-container kpi-grid">
          <div className="dashboard-card">
            <p className="text-sm text-[#ff0a45]">Failed to load KPI data</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <BackToDashboard />
      <header className="space-y-2 mb-6" style={{ paddingLeft: '3rem', paddingRight: '3rem' }}>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
        <h1 className="text-xl font-semibold tracking-tight text-white">Key Performance Indicators</h1>
      </header>

      <div className="dashboard-grid-container kpi-grid">
        {/* KPI GRID - 8 Cards */}
        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">TOTAL LEADS</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{(data.totalLeads ?? 0).toLocaleString()}</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">ACTIVE LEADS</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{(data.activeLeads ?? 0).toLocaleString()}</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">CONVERSION RATE</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{data.conversionRate ?? 0}%</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">ASSIGNMENTS</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{(data.assignments ?? 0).toLocaleString()}</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">IN ESCROW</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{(data.contractsInEscrow ?? 0).toLocaleString()}</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">CONTACT RATE</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{data.contactRate ?? 0}%</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">QUALIFIED LEADS</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">{(data.qualifiedLeads ?? 0).toLocaleString()}</p>
        </div>

        <div className="dashboard-card kpi-tile">
          <p className="text-[11px] uppercase text-white/60 tracking-[0.12em] mb-3">MONTHLY PROFIT</p>
          <p className="text-4xl font-semibold text-[var(--neon-red)] leading-[1.2]">${(data.monthlyProfit ?? 0).toLocaleString()}</p>
        </div>

        {/* CHART GRID - 2 Columns */}
        <div className="dashboard-card kpi-chart-card">
          <h3 className="text-xl font-semibold tracking-tight text-white mb-6">Leads Over Time</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts?.leadsOverTime ?? heroChartData.slice(0, 12)} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis 
                  dataKey="month" 
                  stroke="rgba(255, 255, 255, 0.3)"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: 'rgba(255, 255, 255, 0.4)' }}
                />
                <YAxis 
                  stroke="rgba(255, 255, 255, 0.3)"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: 'rgba(255, 255, 255, 0.4)' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(11, 11, 15, 0.98)', 
                    border: '1px solid rgba(255, 0, 80, 0.3)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="rgba(255, 0, 80, 0.8)" 
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: 'rgba(255, 0, 80, 1)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card kpi-chart-card">
          <h3 className="text-xl font-semibold tracking-tight text-white mb-6">Lead Source Breakdown</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts?.leadTypes ?? leadSourceMock}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => percent > 0.1 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="rgba(255, 0, 80, 0.3)"
                  strokeWidth={1}
                >
                  {(data.charts?.leadTypes ?? leadSourceMock).map((_entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(11, 11, 15, 0.98)', 
                    border: '1px solid rgba(255, 0, 80, 0.3)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  )
}

