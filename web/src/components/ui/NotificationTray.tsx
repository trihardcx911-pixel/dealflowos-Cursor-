/**
 * Notification Tray
 * Displays real-time notifications in a toast-like interface
 */

import React, { useState, useEffect } from "react";
import { useRealtime } from "../../realtime/RealtimeProvider";

interface ToastProps {
  notification: {
    category: string;
    message: string;
    timestamp: number;
    metadata?: Record<string, any>;
  };
  onDismiss: () => void;
}

function Toast({ notification, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onDismiss, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "deal":
        return "🎉";
      case "automation":
        return "⚡";
      case "lead":
        return "📋";
      case "warning":
        return "⚠️";
      case "system":
        return "🔧";
      default:
        return "📌";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "deal":
        return "#22c55e";
      case "automation":
        return "#8b5cf6";
      case "lead":
        return "#3b82f6";
      case "warning":
        return "#f59e0b";
      case "system":
        return "#6b7280";
      default:
        return "#3b82f6";
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`notification-toast ${isVisible ? "visible" : ""} ${isLeaving ? "leaving" : ""}`}
      style={{ borderLeftColor: getCategoryColor(notification.category) }}
    >
      <div className="toast-icon">{getCategoryIcon(notification.category)}</div>
      <div className="toast-content">
        <span className="toast-message">{notification.message}</span>
        <span className="toast-time">{formatTime(notification.timestamp)}</span>
      </div>
      <button className="toast-dismiss" onClick={() => { setIsLeaving(true); setTimeout(onDismiss, 300); }}>
        ✕
      </button>
    </div>
  );
}

export function NotificationTray() {
  const { notifications, clearNotifications } = useRealtime();
  const [displayedIds, setDisplayedIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<Array<{ id: number; notification: any }>>([]);

  // Add new notifications as toasts
  useEffect(() => {
    const newToasts = notifications
      .filter((n) => !displayedIds.has(n.timestamp))
      .slice(0, 3) // Max 3 at a time
      .map((n) => ({ id: n.timestamp, notification: n }));

    if (newToasts.length > 0) {
      setToasts((prev) => [...newToasts, ...prev].slice(0, 5));
      setDisplayedIds((prev) => {
        const next = new Set(prev);
        newToasts.forEach((t) => next.add(t.id));
        return next;
      });
    }
  }, [notifications, displayedIds]);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      <div className="notification-tray">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            notification={toast.notification}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>

      <style>{`
        .notification-tray {
          position: fixed;
          bottom: 24px;
          left: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column-reverse;
          gap: 12px;
          max-width: 400px;
        }

        .notification-toast {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          border-left: 4px solid;
          transform: translateX(-120%);
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        .notification-toast.visible {
          transform: translateX(0);
          opacity: 1;
        }

        .notification-toast.leaving {
          transform: translateX(-120%);
          opacity: 0;
        }

        .toast-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .toast-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .toast-message {
          font-size: 0.875rem;
          color: #1f2937;
          font-weight: 500;
        }

        .toast-time {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .toast-dismiss {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #9ca3af;
          font-size: 1rem;
          line-height: 1;
          transition: color 0.2s;
        }

        .toast-dismiss:hover {
          color: #4b5563;
        }

        @media (max-width: 480px) {
          .notification-tray {
            left: 12px;
            right: 12px;
            max-width: none;
          }
        }
      `}</style>
    </>
  );
}

export default NotificationTray;







