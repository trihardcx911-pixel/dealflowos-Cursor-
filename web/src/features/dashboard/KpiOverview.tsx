/**
 * KPI Overview Dashboard Component
 * Displays key performance indicators in a clean card layout
 */

import { useKpis } from "../../api/hooks";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: string;
  color?: string;
}

function KpiCard({ title, value, subtitle, trend, icon, color = "#3b82f6" }: KpiCardProps) {
  return (
    <div className="kpi-card" style={{ borderLeftColor: color }}>
      <div className="kpi-header">
        {icon && <span className="kpi-icon">{icon}</span>}
        <span className="kpi-title">{title}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`kpi-trend ${trend.isPositive ? "positive" : "negative"}`}>
          {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function KpiOverview() {
  const { data: kpis, isLoading, error } = useKpis();

  if (isLoading) {
    return (
      <div className="kpi-overview loading">
        <div className="kpi-skeleton" />
        <div className="kpi-skeleton" />
        <div className="kpi-skeleton" />
        <div className="kpi-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpi-overview error">
        <p>Failed to load KPIs</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="kpi-overview">
      <h2 className="section-title">📊 Performance Overview</h2>
      
      <div className="kpi-grid">
        <KpiCard
          title="Total Leads"
          value={formatNumber(kpis.totalLeads)}
          subtitle={`${kpis.activeLeads} active`}
          icon="📋"
          color="#3b82f6"
        />
        
        <KpiCard
          title="Qualified Leads"
          value={formatNumber(kpis.qualifiedLeads)}
          subtitle={`${kpis.qualificationRate}% qualification rate`}
          icon="✅"
          color="#10b981"
        />
        
        <KpiCard
          title="Deals Closed"
          value={formatNumber(kpis.closedDealCount)}
          subtitle={`${kpis.dealCloseRatio}% close rate`}
          icon="🤝"
          color="#8b5cf6"
        />
        
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(kpis.totalRevenue || 0)}
          subtitle={`${formatCurrency(kpis.monthlyRevenue || 0)} this month`}
          icon="💰"
          color="#f59e0b"
        />
        
        <KpiCard
          title="Total Profit"
          value={formatCurrency(kpis.totalProfit)}
          subtitle={`${formatCurrency(kpis.weeklyRevenue || 0)} this week`}
          icon="📈"
          color="#22c55e"
        />
        
        <KpiCard
          title="Contact Rate"
          value={`${kpis.contactRate || 0}%`}
          subtitle="Leads contacted"
          icon="📞"
          color="#06b6d4"
        />
        
        <KpiCard
          title="Avg Pipeline Time"
          value={kpis.avgPipelineTime ? `${kpis.avgPipelineTime} days` : "N/A"}
          subtitle="Lead to close"
          icon="⏱️"
          color="#ec4899"
        />
        
        <KpiCard
          title="Daily Activity"
          value={kpis.dailyActivity?.events || 0}
          subtitle={`${kpis.dailyActivity?.leadsCreated || 0} new leads today`}
          icon="⚡"
          color="#f97316"
        />
      </div>

      <style>{`
        .kpi-overview {
          padding: var(--dfos-space-6);
        }
        
        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #1f2937;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--dfos-space-4);
        }
        
        .kpi-card {
          background: white;
          border-radius: var(--dfos-radius-lg);
          padding: var(--dfos-space-5);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .kpi-header {
          display: flex;
          align-items: center;
          gap: var(--dfos-space-2);
          margin-bottom: 0.5rem;
        }
        
        .kpi-icon {
          font-size: 1.25rem;
        }
        
        .kpi-title {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
        }
        
        .kpi-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 0.25rem;
        }
        
        .kpi-subtitle {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        
        .kpi-trend {
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.5rem;
        }
        
        .kpi-trend.positive {
          color: #10b981;
        }
        
        .kpi-trend.negative {
          color: #ef4444;
        }
        
        .kpi-skeleton {
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: var(--dfos-radius-lg);
          height: 120px;
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .kpi-overview.loading .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--dfos-space-4);
        }
        
        .kpi-overview.error {
          text-align: center;
          padding: var(--dfos-space-8);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}

export default KpiOverview;










