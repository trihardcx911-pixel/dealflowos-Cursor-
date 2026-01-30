import { useNavigate } from 'react-router-dom'
import { NeonCard } from './NeonCard'
import { t, useLanguage } from '../i18n/i18n'
import { useKpisSummary } from '../api/hooks'
import { KpiTile } from './KpiTile'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Computes semantic tone (positive/negative/neutral) from current and baseline values
 * @param current - Current period value
 * @param baseline - Previous period value (null/undefined if unavailable; 0 is valid)
 * @param opts - Optional configuration
 * @param opts.epsilon - Deadband threshold: |delta| <= epsilon => neutral (default 0)
 * @returns "positive" | "negative" | "neutral"
 */
function computeTone(
  current: number | null | undefined,
  baseline: number | null | undefined,
  opts?: { epsilon?: number }
): "positive" | "negative" | "neutral" {
  const epsilon = opts?.epsilon ?? 0;
  
  // Missing baseline => neutral (baseline=0 is valid, only null/undefined are missing)
  if (baseline === null || baseline === undefined) return "neutral";
  
  // Missing current => neutral
  if (current === null || current === undefined) return "neutral";
  
  // NaN/Infinity => neutral
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return "neutral";
  
  // Compute delta
  const delta = current - baseline;
  
  // Within epsilon deadband => neutral (handles zero delta and small jitter)
  if (Math.abs(delta) <= epsilon) return "neutral";
  
  // Higher is better (all current KPIs)
  return delta > 0 ? "positive" : "negative";
}

export function KpiCard() {
  const navigate = useNavigate()
  const lang = useLanguage()

  const { data, isLoading, isError } = useKpisSummary()

  const isBusy = isLoading || isError

  // Active Leads: separate numeric current and display value
  const activeLeadsNumeric = data?.activeLeads;
  const activeLeadsDisplay = isBusy ? "—" : String(activeLeadsNumeric ?? 0);
  const activeLeadsTone = computeTone(activeLeadsNumeric, data?.prevActiveLeads);

  // Conversion Rate: use epsilon=0.1 to avoid jitter from tiny floating changes
  const conversionRateNumeric = data?.conversionRate;
  const conversionRateDisplay = isBusy ? "—" : `${Number(conversionRateNumeric ?? 0).toFixed(1)}%`;
  const conversionRateTone = computeTone(conversionRateNumeric, data?.prevConversionRate, { epsilon: 0.1 });

  // New Leads: separate numeric current and display value
  const monthlyNewLeadsNumeric = data?.monthlyNewLeads;
  const monthlyNewLeadsDisplay = isBusy ? "—" : String(monthlyNewLeadsNumeric ?? 0);
  const monthlyNewLeadsTone = computeTone(monthlyNewLeadsNumeric, data?.prevMonthlyNewLeads);

  // Profit: ensure no $NaN or $undefined, force neutral if display is "—"
  const monthlyProfitNumeric = data?.monthlyProfit;
  const monthlyProfitDisplay = isBusy || monthlyProfitNumeric === null || monthlyProfitNumeric === undefined || !Number.isFinite(monthlyProfitNumeric)
    ? "—"
    : formatCurrency(monthlyProfitNumeric);
  // Force neutral tone if display is "—" (by passing undefined to computeTone)
  const monthlyProfitTone = monthlyProfitDisplay === "—" 
    ? "neutral" 
    : computeTone(monthlyProfitNumeric, data?.prevMonthlyProfit);

  // Silver gating for milestone KPIs
  // DFOS_FEATURE_MILESTONES is dev override only; production uses DFOS_PLAN_TIER
  const isSilver = localStorage.getItem("DFOS_PLAN_TIER") === "silver";
  const milestonesEnabled = isSilver || localStorage.getItem("DFOS_FEATURE_MILESTONES") === "1";
  // Note: No backend enforcement in this phase (UI-only gating)

  // Assignments MTD
  const assignmentsMTDNumeric = data?.assignmentsMTD;
  const assignmentsMTDDisplay = milestonesEnabled
    ? (isBusy ? "—" : String(assignmentsMTDNumeric ?? 0))
    : "—";
  const assignmentsMTDTone = milestonesEnabled ? "neutral" : "neutral";

  // In Escrow
  const inEscrowNumeric = data?.inEscrow;
  const inEscrowDisplay = milestonesEnabled
    ? (isBusy ? "—" : String(inEscrowNumeric ?? 0))
    : "—";
  const inEscrowTone = milestonesEnabled ? "neutral" : "neutral";

  return (
    <NeonCard
      sectionLabel={t('dashboard.analytics')}
      title={t('dashboard.viewKpis')}
      onClick={() => navigate('/kpis')}
      colSpan={4}
      className="h-full"
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="grid grid-cols-2 grid-rows-2 gap-dfos-3 h-full">
          <KpiTile
            label={t('dashboard.activeLeads')}
            value={activeLeadsDisplay}
            tone={activeLeadsTone}
            isLoading={isBusy}
          />
          <KpiTile
            label={t('dashboard.conversionRate')}
            value={conversionRateDisplay}
            tone={conversionRateTone}
            isLoading={isBusy}
          />
          <KpiTile
            label={t('dashboard.newLeadsMtd')}
            value={monthlyNewLeadsDisplay}
            tone={monthlyNewLeadsTone}
            isLoading={isBusy}
          />
          <KpiTile
            label={t('dashboard.profitMtd')}
            value={monthlyProfitDisplay}
            tone={monthlyProfitTone}
            isLoading={isBusy}
          />
        </div>
      </div>
    </NeonCard>
  )
}
