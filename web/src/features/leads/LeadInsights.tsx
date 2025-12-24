/**
 * Lead Insights Panel
 * Shows lead score, recommendations, engagement metrics, and event timeline
 */

import { useLeadInsights, useLeadScore, useLeadEvents } from "../../api/hooks";

interface LeadInsightsProps {
  leadId: string;
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="score-gauge">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dy="0.35em" className="gauge-text">
          {score}
        </text>
      </svg>
      <span className="gauge-label">{label}</span>
    </div>
  );
}

function RecommendationCard({ recommendations }: { recommendations: string[] }) {
  if (!recommendations.length) {
    return (
      <div className="recommendation-card success">
        <span className="icon">✅</span>
        <span>This lead is on track!</span>
      </div>
    );
  }

  return (
    <div className="recommendations">
      <h4>💡 Recommendations</h4>
      <ul>
        {recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
    </div>
  );
}

function EventTimeline({ events }: { events: any[] }) {
  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      call: "📞",
      sms: "💬",
      email: "📧",
      note: "📝",
      status_changed: "🔄",
      qualified: "✅",
      disqualified: "❌",
      deal_created: "🤝",
      deal_closed: "🎉",
      created: "➕",
      updated: "✏️",
    };
    return icons[type] || "📌";
  };

  return (
    <div className="event-timeline">
      <h4>📅 Recent Activity</h4>
      {events.length === 0 ? (
        <p className="no-events">No activity yet</p>
      ) : (
        <ul className="timeline-list">
          {events.slice(0, 10).map((event) => (
            <li key={event.id} className="timeline-item">
              <span className="event-icon">{getEventIcon(event.eventType)}</span>
              <div className="event-content">
                <span className="event-type">{event.eventType.replace(/_/g, " ")}</span>
                <span className="event-time">{formatTime(event.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeadInsights({ leadId }: LeadInsightsProps) {
  const { data: insights, isLoading: insightsLoading } = useLeadInsights(leadId);
  const { data: score, isLoading: scoreLoading } = useLeadScore(leadId);
  const { data: eventsData } = useLeadEvents(leadId, 20);

  const isLoading = insightsLoading || scoreLoading;

  if (isLoading) {
    return <div className="lead-insights loading">Loading insights...</div>;
  }

  if (!insights || !score) {
    return <div className="lead-insights error">Failed to load insights</div>;
  }

  const formatCurrency = (value: any) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(value) || 0);

  return (
    <div className="lead-insights">
      <div className="insights-header">
        <h3>🔍 Lead Insights</h3>
        <div className="lead-status" data-status={insights.lead.status}>
          {insights.lead.status}
        </div>
      </div>

      {/* Score Section */}
      <div className="scores-section">
        <ScoreGauge score={score.totalScore} label="Total Score" />
        
        <div className="score-breakdown">
          <div className="breakdown-item">
            <span className="breakdown-label">Engagement</span>
            <div className="breakdown-bar">
              <div className="bar-fill" style={{ width: `${Math.min(score.engagementScore * 2, 100)}%`, background: "#3b82f6" }} />
            </div>
            <span className="breakdown-value">{score.engagementScore}</span>
          </div>
          
          <div className="breakdown-item">
            <span className="breakdown-label">Urgency</span>
            <div className="breakdown-bar">
              <div className="bar-fill" style={{ width: `${Math.max(0, (score.urgencyScore + 15) * 3)}%`, background: score.urgencyScore >= 0 ? "#22c55e" : "#ef4444" }} />
            </div>
            <span className="breakdown-value">{score.urgencyScore}</span>
          </div>
          
          <div className="breakdown-item">
            <span className="breakdown-label">Deal Quality</span>
            <div className="breakdown-bar">
              <div className="bar-fill" style={{ width: `${Math.min(Math.max(score.dealScore, 0), 100)}%`, background: "#8b5cf6" }} />
            </div>
            <span className="breakdown-value">{score.dealScore}</span>
          </div>
        </div>
      </div>

      {/* Deal Readiness */}
      <div className="readiness-section">
        <h4>📋 Deal Readiness</h4>
        <div className={`readiness-badge ${insights.readiness.ready ? "ready" : "not-ready"}`}>
          {insights.readiness.ready ? "✅ Ready for Deal" : "⚠️ Not Ready"}
        </div>
        {!insights.readiness.ready && insights.readiness.issues.length > 0 && (
          <ul className="issues-list">
            {insights.readiness.issues.map((issue: string, i: number) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}
        {insights.readiness.spread && (
          <div className="spread-info">
            <span>MOA-Offer Spread:</span>
            <strong>{formatCurrency(insights.readiness.spread)}</strong>
          </div>
        )}
      </div>

      {/* Engagement Metrics */}
      <div className="engagement-section">
        <h4>📊 Engagement</h4>
        <div className="engagement-grid">
          <div className="engagement-stat">
            <span className="stat-value">{insights.engagement.totalEvents}</span>
            <span className="stat-label">Total Events</span>
          </div>
          <div className="engagement-stat">
            <span className="stat-value">{insights.engagement.daysSinceLastActivity}</span>
            <span className="stat-label">Days Since Activity</span>
          </div>
          <div className="engagement-stat">
            <span className="stat-value">{insights.engagement.eventBreakdown?.call || 0}</span>
            <span className="stat-label">Calls</span>
          </div>
          <div className="engagement-stat">
            <span className="stat-value">{insights.engagement.eventBreakdown?.sms || 0}</span>
            <span className="stat-label">SMS</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <RecommendationCard recommendations={score.recommendations} />

      {/* Event Timeline */}
      <EventTimeline events={eventsData?.data || insights.recentEvents || []} />

      <style>{`
        .lead-insights {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .insights-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        
        .insights-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }
        
        .lead-status {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
          background: #e5e7eb;
          color: #374151;
        }
        
        .lead-status[data-status="qualified"] { background: #dcfce7; color: #166534; }
        .lead-status[data-status="contacted"] { background: #dbeafe; color: #1e40af; }
        .lead-status[data-status="under_contract"] { background: #d1fae5; color: #065f46; }
        .lead-status[data-status="dead"] { background: #fee2e2; color: #991b1b; }
        
        .scores-section {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .score-gauge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        
        .gauge-svg {
          width: 100px;
          height: 100px;
        }
        
        .gauge-text {
          font-size: 24px;
          font-weight: 700;
          fill: #1f2937;
        }
        
        .gauge-label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        
        .score-breakdown {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .breakdown-item {
          display: grid;
          grid-template-columns: 100px 1fr 40px;
          align-items: center;
          gap: 0.5rem;
        }
        
        .breakdown-label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        
        .breakdown-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .bar-fill {
          height: 100%;
          border-radius: 4px;
        }
        
        .breakdown-value {
          font-size: 0.75rem;
          font-weight: 600;
          text-align: right;
        }
        
        .readiness-section, .engagement-section, .recommendations, .event-timeline {
          margin-bottom: 1.5rem;
        }
        
        .readiness-section h4, .engagement-section h4, .recommendations h4, .event-timeline h4 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.75rem;
        }
        
        .readiness-badge {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
        }
        
        .readiness-badge.ready { background: #dcfce7; color: #166534; }
        .readiness-badge.not-ready { background: #fef3c7; color: #92400e; }
        
        .issues-list {
          margin: 0.75rem 0 0;
          padding-left: 1.25rem;
          font-size: 0.875rem;
          color: #92400e;
        }
        
        .spread-info {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #6b7280;
        }
        
        .spread-info strong {
          color: #22c55e;
          margin-left: 0.5rem;
        }
        
        .engagement-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }
        
        .engagement-stat {
          text-align: center;
        }
        
        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }
        
        .stat-label {
          font-size: 0.625rem;
          color: #9ca3af;
          text-transform: uppercase;
        }
        
        .recommendations ul {
          margin: 0;
          padding-left: 1.25rem;
        }
        
        .recommendations li {
          font-size: 0.875rem;
          color: #4b5563;
          margin-bottom: 0.5rem;
        }
        
        .recommendation-card.success {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #dcfce7;
          border-radius: 8px;
          color: #166534;
        }
        
        .timeline-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .timeline-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .timeline-item:last-child {
          border-bottom: none;
        }
        
        .event-icon {
          font-size: 1.25rem;
        }
        
        .event-content {
          flex: 1;
          display: flex;
          justify-content: space-between;
        }
        
        .event-type {
          font-size: 0.875rem;
          text-transform: capitalize;
        }
        
        .event-time {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        
        .no-events {
          color: #9ca3af;
          font-style: italic;
        }
        
        .lead-insights.loading, .lead-insights.error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

export default LeadInsights;










