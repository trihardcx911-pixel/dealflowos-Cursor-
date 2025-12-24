import BackToDashboard from "../components/BackToDashboard";
import KpiChart from "../features/dashboard/KpiChart";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api";

interface KpiPayload {
  totalLeads: number;
  activeLeads: number;
  conversionRate: number;
  assignments: number;
  contractsInEscrow: number;
  contactRate: number;
  monthlyNewLeads: number;
  monthlyProfit: number;
}

export default function KpisPage() {
  const { data, isLoading, error } = useQuery<KpiPayload>({
    queryKey: ["kpis-summary"],
    queryFn: () => get<KpiPayload>("/api/kpis"),   // FIXED ENDPOINT
  });

  return (
    <>
      <BackToDashboard />

      <header className="space-y-2 mb-6 px-12">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Analytics</p>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Key Performance Indicators
        </h1>
      </header>

      <div className="dashboard-grid-container mb-10">
        {isLoading && (
          <div className="dashboard-card">
            <p className="text-white/60">Loading...</p>
          </div>
        )}

        {error && (
          <div className="dashboard-card">
            <p className="text-[#ff0a45]">Failed to load KPI summary</p>
          </div>
        )}

        {data && (
          <>
            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">TOTAL LEADS</p>
              <p className="kpi-value">{data.totalLeads}</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">ACTIVE LEADS</p>
              <p className="kpi-value">{data.activeLeads}</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">CONVERSION RATE</p>
              <p className="kpi-value">{data.conversionRate}%</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">ASSIGNMENTS</p>
              <p className="kpi-value">{data.assignments}</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">IN ESCROW</p>
              <p className="kpi-value">{data.contractsInEscrow}</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">CONTACT RATE</p>
              <p className="kpi-value">{data.contactRate}%</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">QUALIFIED LEADS</p>
              <p className="kpi-value">{(data as any).qualifiedLeads ?? 0}</p>
            </div>

            <div className="dashboard-card kpi-tile">
              <p className="kpi-label">MONTHLY PROFIT</p>
              <p className="kpi-value">${data.monthlyProfit}</p>
            </div>
          </>
        )}
      </div>

      <KpiChart />
    </>
  );
}
