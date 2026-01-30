/**
 * Pipeline Status Card
 * Shows leads per stage, conversion rates, and bottleneck detection
 */

import { usePipelineSummary } from "../../api/hooks";

const STAGE_COLORS: Record<string, string> = {
  new: "#6b7280",
  contacted: "#3b82f6",
  qualified: "#8b5cf6",
  offer_made: "#f59e0b",
  under_contract: "#10b981",
  closed: "#22c55e",
  dead: "#ef4444",
};

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  offer_made: "Offer Made",
  under_contract: "Under Contract",
  closed: "Closed",
  dead: "Dead",
};

export function PipelineStatusCard() {
  const { data, isLoading, error } = usePipelineSummary();

  if (isLoading) {
    return (
      <div className="pipeline-card loading">
        <div className="pipeline-skeleton" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="pipeline-card error">
        <p>Failed to load pipeline data</p>
      </div>
    );
  }

  const totalActive = data.stages
    .filter(s => !["closed", "dead"].includes(s.stage))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="pipeline-card">
      <div className="pipeline-header">
        <h3>🎯 Pipeline Status</h3>
        <div className="health-badge" data-rating={data.health.rating.toLowerCase()}>
          Score: {data.health.score}
        </div>
      </div>

      <div className="pipeline-stages">
        {data.stages
          .filter(s => s.stage !== "dead")
          .map(stage => {
            const percentage = totalActive > 0 ? (stage.count / totalActive) * 100 : 0;
            const isBottleneck = data.bottleneck?.stage === stage.stage;
            
            return (
              <div 
                key={stage.stage} 
                className={`stage-row ${isBottleneck ? "bottleneck" : ""}`}
              >
                <div className="stage-info">
                  <span 
                    className="stage-dot" 
                    style={{ backgroundColor: STAGE_COLORS[stage.stage] || "#6b7280" }}
                  />
                  <span className="stage-name">
                    {STAGE_LABELS[stage.stage] || stage.stage}
                  </span>
                  {isBottleneck && <span className="bottleneck-badge">⚠️ Bottleneck</span>}
                </div>
                <div className="stage-count">{stage.count}</div>
                <div className="stage-bar-container">
                  <div 
                    className="stage-bar" 
                    style={{ 
                      width: `${Math.max(percentage, 2)}%`,
                      backgroundColor: STAGE_COLORS[stage.stage] || "#6b7280"
                    }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {data.bottleneck && (
        <div className="bottleneck-alert">
          <span className="alert-icon">⚠️</span>
          <span>{data.bottleneck.recommendation}</span>
        </div>
      )}

      <div className="pipeline-metrics">
        <div className="metric">
          <span className="metric-label">Velocity</span>
          <span className="metric-value">
            {data.velocity ? `${data.velocity.toFixed(1)}h avg` : "N/A"}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Active Leads</span>
          <span className="metric-value">{data.health.metrics.activeLeads}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Stuck Leads</span>
          <span className="metric-value stuck">{data.health.metrics.stuckLeads}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Weekly Activity</span>
          <span className="metric-value">{data.health.metrics.weeklyActivity}</span>
        </div>
      </div>

      <style>{`
        .pipeline-card {
          background: white;
          border-radius: var(--dfos-radius-xl);
          padding: var(--dfos-space-6);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .pipeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        
        .pipeline-header h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        
        .health-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .health-badge[data-rating="excellent"] {
          background: #dcfce7;
          color: #166534;
        }
        
        .health-badge[data-rating="good"] {
          background: #dbeafe;
          color: #1e40af;
        }
        
        .health-badge[data-rating="fair"] {
          background: #fef3c7;
          color: #92400e;
        }
        
        .health-badge[data-rating="needs attention"] {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .pipeline-stages {
          display: flex;
          flex-direction: column;
          gap: var(--dfos-space-3);
        }
        
        .stage-row {
          display: grid;
          grid-template-columns: 180px 50px 1fr;
          align-items: center;
          gap: var(--dfos-space-3);
          padding: 0.5rem;
          border-radius: var(--dfos-radius-md);
          transition: background 0.2s;
        }
        
        .stage-row:hover {
          background: #f9fafb;
        }
        
        .stage-row.bottleneck {
          background: #fef3c7;
        }
        
        .stage-info {
          display: flex;
          align-items: center;
          gap: var(--dfos-space-2);
        }
        
        .stage-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        
        .stage-name {
          font-size: 0.875rem;
          color: #4b5563;
        }
        
        .bottleneck-badge {
          font-size: 0.625rem;
          background: #fbbf24;
          color: #78350f;
          padding: 0.125rem 0.375rem;
          border-radius: var(--dfos-radius-sm);
        }
        
        .stage-count {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1f2937;
          text-align: right;
        }
        
        .stage-bar-container {
          height: 8px;
          background: #e5e7eb;
          border-radius: var(--dfos-radius-sm);
          overflow: hidden;
        }
        
        .stage-bar {
          height: 100%;
          border-radius: var(--dfos-radius-sm);
          transition: width 0.3s ease;
        }
        
        .bottleneck-alert {
          display: flex;
          align-items: center;
          gap: var(--dfos-space-2);
          margin-top: 1rem;
          padding: 0.75rem;
          background: #fef3c7;
          border-radius: var(--dfos-radius-md);
          font-size: 0.875rem;
          color: #92400e;
        }
        
        .pipeline-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--dfos-space-4);
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: var(--dfos-border-sm) solid #e5e7eb;
        }
        
        .metric {
          text-align: center;
        }
        
        .metric-label {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }
        
        .metric-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }
        
        .metric-value.stuck {
          color: #ef4444;
        }
        
        .pipeline-card.loading {
          min-height: 300px;
        }
        
        .pipeline-skeleton {
          height: 100%;
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: var(--dfos-radius-md);
        }
      `}</style>
    </div>
  );
}

export default PipelineStatusCard;










