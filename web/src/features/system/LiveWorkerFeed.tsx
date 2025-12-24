/**
 * Live Worker Feed
 * Shows real-time worker activity from WebSocket
 */

import React, { useState, useEffect } from "react";
import { useRealtime, useRealtimeEvent } from "../../realtime/RealtimeProvider";
import { EVENTS, WorkerEvent } from "../../realtime/events";

interface WorkerRun {
  workerName: string;
  status: "started" | "completed" | "failed";
  runAt: string;
  duration?: number;
  error?: string;
  timestamp: number;
}

export function LiveWorkerFeed() {
  const [runs, setRuns] = useState<WorkerRun[]>([]);
  const { events } = useRealtime();

  // Listen for worker events
  useEffect(() => {
    const workerEvents = events.filter(
      (e) =>
        e.type === EVENTS.WORKER_STARTED ||
        e.type === EVENTS.WORKER_COMPLETED ||
        e.type === EVENTS.WORKER_FAILED
    ) as WorkerEvent[];

    const newRuns = workerEvents.map((e) => ({
      workerName: e.workerName,
      status: e.type === EVENTS.WORKER_STARTED
        ? "started"
        : e.type === EVENTS.WORKER_COMPLETED
        ? "completed"
        : "failed",
      runAt: e.runAt,
      duration: e.duration,
      error: e.error,
      timestamp: e.timestamp,
    })) as WorkerRun[];

    if (newRuns.length > 0) {
      setRuns(newRuns.slice(0, 20));
    }
  }, [events]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "started":
        return "🔄";
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "⚙️";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "started":
        return "#3b82f6";
      case "completed":
        return "#22c55e";
      case "failed":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="live-worker-feed">
      <h4>🔴 Live Worker Activity</h4>

      {runs.length === 0 ? (
        <div className="empty-state">
          <p>Waiting for worker activity...</p>
          <span className="pulse-dot" />
        </div>
      ) : (
        <div className="feed-list">
          {runs.map((run, index) => (
            <div
              key={`${run.timestamp}-${index}`}
              className="feed-item"
              style={{ borderLeftColor: getStatusColor(run.status) }}
            >
              <span className="feed-icon">{getStatusIcon(run.status)}</span>
              <div className="feed-content">
                <div className="feed-header">
                  <span className="worker-name">{run.workerName}</span>
                  <span className="feed-status" style={{ color: getStatusColor(run.status) }}>
                    {run.status}
                  </span>
                </div>
                <div className="feed-meta">
                  <span className="feed-time">{formatTime(run.timestamp)}</span>
                  {run.duration && <span className="feed-duration">{run.duration}ms</span>}
                </div>
                {run.error && <div className="feed-error">{run.error}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .live-worker-feed {
          background: white;
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .live-worker-feed h4 {
          margin: 0 0 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .empty-state {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          color: #9ca3af;
          font-size: 0.875rem;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .feed-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 300px;
          overflow-y: auto;
        }

        .feed-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #f9fafb;
          border-radius: 6px;
          border-left: 3px solid;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .feed-icon {
          font-size: 1rem;
        }

        .feed-content {
          flex: 1;
        }

        .feed-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .worker-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: #374151;
        }

        .feed-status {
          font-size: 0.625rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .feed-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.625rem;
          color: #9ca3af;
          margin-top: 0.125rem;
        }

        .feed-duration {
          color: #6b7280;
        }

        .feed-error {
          margin-top: 0.25rem;
          font-size: 0.625rem;
          color: #ef4444;
          background: #fee2e2;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default LiveWorkerFeed;







