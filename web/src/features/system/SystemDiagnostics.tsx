/**
 * System Diagnostics Page
 * Shows CPU, memory, queue health, worker status, and database latency
 */

import { useSystemMetrics, useWorkerStatus, useSystemHealth, useSystemStats, useTriggerWorker } from "../../api/hooks";

function MetricCard({ title, value, subtitle, status, icon }: {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: "healthy" | "warning" | "unhealthy";
  icon?: string;
}) {
  return (
    <div className={`metric-card ${status || ""}`}>
      {icon && <span className="metric-icon">{icon}</span>}
      <div className="metric-content">
        <span className="metric-title">{title}</span>
        <span className="metric-value">{value}</span>
        {subtitle && <span className="metric-subtitle">{subtitle}</span>}
      </div>
      {status && (
        <span className={`status-indicator ${status}`}>
          {status === "healthy" ? "✓" : status === "warning" ? "⚠" : "✕"}
        </span>
      )}
    </div>
  );
}

function WorkerCard({ worker, onTrigger }: { worker: any; onTrigger: () => void }) {
  const formatDate = (date?: string) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`worker-card ${worker.isRunning ? "running" : ""} ${worker.errorCount > 0 ? "has-errors" : ""}`}>
      <div className="worker-header">
        <span className="worker-name">{worker.name}</span>
        <span className={`worker-status ${worker.isRunning ? "running" : "idle"}`}>
          {worker.isRunning ? "Running" : "Idle"}
        </span>
      </div>
      
      <div className="worker-details">
        <div className="worker-stat">
          <span className="stat-label">Pattern</span>
          <span className="stat-value">{worker.pattern}</span>
        </div>
        <div className="worker-stat">
          <span className="stat-label">Last Run</span>
          <span className="stat-value">{formatDate(worker.lastRun)}</span>
        </div>
        <div className="worker-stat">
          <span className="stat-label">Next Run</span>
          <span className="stat-value">{formatDate(worker.nextRun)}</span>
        </div>
        <div className="worker-stat">
          <span className="stat-label">Run Count</span>
          <span className="stat-value">{worker.runCount}</span>
        </div>
        <div className="worker-stat">
          <span className="stat-label">Errors</span>
          <span className={`stat-value ${worker.errorCount > 0 ? "error" : ""}`}>
            {worker.errorCount}
          </span>
        </div>
      </div>
      
      {worker.lastError && (
        <div className="worker-error">
          <strong>Last Error:</strong> {worker.lastError}
        </div>
      )}
      
      <button 
        className="trigger-button" 
        onClick={onTrigger}
        disabled={worker.isRunning}
      >
        {worker.isRunning ? "Running..." : "Run Now"}
      </button>
    </div>
  );
}

export function SystemDiagnostics() {
  const { data: metrics, isLoading: metricsLoading } = useSystemMetrics();
  const { data: workersData, isLoading: workersLoading } = useWorkerStatus();
  const { data: health } = useSystemHealth();
  const { data: stats } = useSystemStats();
  const triggerWorker = useTriggerWorker();

  const isLoading = metricsLoading || workersLoading;

  if (isLoading) {
    return <div className="system-diagnostics loading">Loading diagnostics...</div>;
  }

  const getMemoryStatus = (percent: number) => {
    if (percent < 70) return "healthy";
    if (percent < 85) return "warning";
    return "unhealthy";
  };

  const getCpuStatus = (load: number) => {
    if (load < 1) return "healthy";
    if (load < 2) return "warning";
    return "unhealthy";
  };

  const getQueueStatus = (pending: number) => {
    if (pending < 100) return "healthy";
    if (pending < 500) return "warning";
    return "unhealthy";
  };

  return (
    <div className="system-diagnostics">
      <div className="diagnostics-header">
        <h1>🔧 System Diagnostics</h1>
        <span className="last-updated">
          Last updated: {new Date(metrics?.timestamp || Date.now()).toLocaleTimeString()}
        </span>
      </div>

      {/* System Health Overview */}
      <section className="section">
        <h2>System Health</h2>
        <div className="metrics-grid">
          <MetricCard
            title="CPU Load (1m)"
            value={metrics?.system.cpuLoad[0].toFixed(2) || "N/A"}
            status={getCpuStatus(metrics?.system.cpuLoad[0] || 0)}
            icon="🖥️"
          />
          <MetricCard
            title="Memory Usage"
            value={`${metrics?.system.memoryUsagePercent || 0}%`}
            subtitle={`${metrics?.process.heapUsedMB || 0}MB heap used`}
            status={getMemoryStatus(metrics?.system.memoryUsagePercent || 0)}
            icon="💾"
          />
          <MetricCard
            title="Event Queue"
            value={metrics?.queue.eventsPending || 0}
            subtitle={metrics?.queue.isProcessing ? "Processing..." : "Idle"}
            status={getQueueStatus(metrics?.queue.eventsPending || 0)}
            icon="📦"
          />
          <MetricCard
            title="Uptime"
            value={`${metrics?.process.uptimeHours || 0}h`}
            icon="⏱️"
            status="healthy"
          />
        </div>
      </section>

      {/* Database & Dependencies */}
      <section className="section">
        <h2>Dependencies</h2>
        <div className="metrics-grid">
          {health?.checks && Object.entries(health.checks).map(([name, check]: [string, any]) => (
            <MetricCard
              key={name}
              title={name.charAt(0).toUpperCase() + name.slice(1)}
              value={check.status}
              subtitle={check.latency !== undefined ? `${check.latency}ms` : undefined}
              status={check.status === "healthy" ? "healthy" : "unhealthy"}
              icon={name === "database" ? "🗄️" : name === "memory" ? "💾" : "📊"}
            />
          ))}
        </div>
      </section>

      {/* Entity Stats */}
      <section className="section">
        <h2>Database Stats</h2>
        <div className="metrics-grid">
          <MetricCard title="Leads" value={stats?.entities.leads || 0} icon="📋" />
          <MetricCard title="Deals" value={stats?.entities.deals || 0} icon="🤝" />
          <MetricCard title="Events" value={stats?.entities.events || 0} icon="📌" />
          <MetricCard title="Users" value={stats?.entities.users || 0} icon="👥" />
        </div>
      </section>

      {/* Background Workers */}
      <section className="section">
        <h2>Background Workers</h2>
        <div className="workers-summary">
          <span>Total: {workersData?.summary.total || 0}</span>
          <span className="healthy">Healthy: {workersData?.summary.healthy || 0}</span>
          <span className="errors">With Errors: {workersData?.summary.withErrors || 0}</span>
        </div>
        <div className="workers-grid">
          {workersData?.workers.map((worker) => (
            <WorkerCard
              key={worker.name}
              worker={worker}
              onTrigger={() => triggerWorker.mutate(worker.name)}
            />
          ))}
        </div>
      </section>

      <style>{`
        .system-diagnostics {
          padding: var(--dfos-space-8);
          max-width: 1400px;
          margin: 0 auto;
        }
        
        .diagnostics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        
        .diagnostics-header h1 {
          margin: 0;
          font-size: 1.5rem;
        }
        
        .last-updated {
          font-size: 0.875rem;
          color: #6b7280;
        }
        
        .section {
          margin-bottom: 2rem;
        }
        
        .section h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #374151;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--dfos-space-4);
        }
        
        .metric-card {
          display: flex;
          align-items: center;
          gap: var(--dfos-space-4);
          background: white;
          border-radius: var(--dfos-radius-lg);
          padding: var(--dfos-space-5);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: var(--dfos-border-lg) solid #e5e7eb;
        }
        
        .metric-card.healthy { border-left-color: #22c55e; }
        .metric-card.warning { border-left-color: #f59e0b; }
        .metric-card.unhealthy { border-left-color: #ef4444; }
        
        .metric-icon {
          font-size: 1.5rem;
        }
        
        .metric-content {
          flex: 1;
        }
        
        .metric-title {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }
        
        .metric-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1f2937;
        }
        
        .metric-subtitle {
          display: block;
          font-size: 0.625rem;
          color: #9ca3af;
          margin-top: 0.25rem;
        }
        
        .status-indicator {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
        }
        
        .status-indicator.healthy { background: #dcfce7; color: #166534; }
        .status-indicator.warning { background: #fef3c7; color: #92400e; }
        .status-indicator.unhealthy { background: #fee2e2; color: #991b1b; }
        
        .workers-summary {
          display: flex;
          gap: var(--dfos-space-6);
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        
        .workers-summary .healthy { color: #22c55e; }
        .workers-summary .errors { color: #ef4444; }
        
        .workers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--dfos-space-4);
        }
        
        .worker-card {
          background: white;
          border-radius: var(--dfos-radius-lg);
          padding: var(--dfos-space-5);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: var(--dfos-border-md) solid transparent;
        }
        
        .worker-card.running {
          border-color: #3b82f6;
        }
        
        .worker-card.has-errors {
          border-color: #ef4444;
        }
        
        .worker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .worker-name {
          font-weight: 600;
          color: #1f2937;
        }
        
        .worker-status {
          padding: 0.25rem 0.5rem;
          border-radius: var(--dfos-radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .worker-status.running { background: #dbeafe; color: #1e40af; }
        .worker-status.idle { background: #e5e7eb; color: #374151; }
        
        .worker-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--dfos-space-2);
          margin-bottom: 1rem;
        }
        
        .worker-stat {
          display: flex;
          flex-direction: column;
        }
        
        .stat-label {
          font-size: 0.625rem;
          color: #9ca3af;
          text-transform: uppercase;
        }
        
        .stat-value {
          font-size: 0.875rem;
          color: #4b5563;
        }
        
        .stat-value.error {
          color: #ef4444;
          font-weight: 600;
        }
        
        .worker-error {
          background: #fee2e2;
          color: #991b1b;
          padding: 0.5rem;
          border-radius: var(--dfos-radius-sm);
          font-size: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .trigger-button {
          width: 100%;
          padding: 0.5rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: var(--dfos-radius-md);
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .trigger-button:hover:not(:disabled) {
          background: #2563eb;
        }
        
        .trigger-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        .system-diagnostics.loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

export default SystemDiagnostics;










