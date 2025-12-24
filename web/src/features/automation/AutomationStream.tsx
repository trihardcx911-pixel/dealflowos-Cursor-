/**
 * Automation Stream Panel
 * Shows real-time automation rule triggers
 */

import React from "react";
import { useRealtime } from "../../realtime/RealtimeProvider";

export function AutomationStream() {
  const { automationEvents, clearAutomationEvents } = useRealtime();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "status_change":
        return "🔄";
      case "deal_created":
        return "🤝";
      case "deal_closed":
        return "🎉";
      case "lead_created":
        return "➕";
      case "qualification_changed":
        return "✅";
      default:
        return "⚡";
    }
  };

  return (
    <div className="automation-stream">
      <div className="stream-header">
        <h3>⚡ Automation Activity</h3>
        {automationEvents.length > 0 && (
          <button className="clear-btn" onClick={clearAutomationEvents}>
            Clear
          </button>
        )}
      </div>

      {automationEvents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🤖</span>
          <p>No automation triggers yet</p>
          <span className="empty-hint">Rules will appear here when they fire</span>
        </div>
      ) : (
        <div className="stream-list">
          {automationEvents.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className="stream-item">
              <div className="item-icon">{getActionIcon(event.actionType)}</div>
              <div className="item-content">
                <div className="item-header">
                  <span className="rule-name">{event.ruleName}</span>
                  <span className="action-type">{event.actionType.replace(/_/g, " ")}</span>
                </div>
                <p className="item-message">{event.message}</p>
                <div className="item-meta">
                  <span className="lead-id">Lead: {event.leadId?.slice(0, 8)}...</span>
                  <span className="timestamp">{formatTime(event.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .automation-stream {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          max-height: 400px;
          display: flex;
          flex-direction: column;
        }

        .stream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .stream-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .clear-btn {
          background: none;
          border: 1px solid #e5e7eb;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
        }

        .empty-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .empty-state p {
          margin: 0;
          color: #6b7280;
          font-weight: 500;
        }

        .empty-hint {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.5rem;
        }

        .stream-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .stream-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 8px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .item-icon {
          font-size: 1.25rem;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .item-content {
          flex: 1;
          min-width: 0;
        }

        .item-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .rule-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1f2937;
        }

        .action-type {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 4px;
          text-transform: capitalize;
        }

        .item-message {
          margin: 0;
          font-size: 0.75rem;
          color: #4b5563;
        }

        .item-meta {
          display: flex;
          gap: 1rem;
          margin-top: 0.25rem;
          font-size: 0.625rem;
          color: #9ca3af;
        }

        .lead-id {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}

export default AutomationStream;







