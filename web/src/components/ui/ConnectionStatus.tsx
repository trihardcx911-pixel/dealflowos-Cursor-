/**
 * Connection Status Indicator
 * Shows WebSocket connection state
 */

import React from "react";
import { useRealtime } from "../../realtime/RealtimeProvider";

export function ConnectionStatus() {
  const { connectionStatus } = useRealtime();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return { color: "#22c55e", label: "Live", icon: "🟢" };
      case "connecting":
        return { color: "#f59e0b", label: "Connecting...", icon: "🟡" };
      case "disconnected":
        return { color: "#ef4444", label: "Offline", icon: "🔴" };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="connection-status" style={{ color: config.color }}>
      <span className="status-dot" style={{ backgroundColor: config.color }} />
      <span className="status-label">{config.label}</span>

      <style>{`
        .connection-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .status-label {
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}

export default ConnectionStatus;







