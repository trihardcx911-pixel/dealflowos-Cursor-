/**
 * Real-Time Event Types (Frontend)
 * Mirrors backend event definitions
 */

export const EVENTS = {
  // Connection events
  CONNECTION_ACK: "connection_ack",
  PING: "ping",
  PONG: "pong",

  // Lead events
  LEAD_CREATED: "lead_created",
  LEAD_UPDATED: "lead_updated",
  LEAD_DELETED: "lead_deleted",
  LEAD_SCORE_UPDATED: "lead_score_updated",
  STATUS_CHANGED: "status_changed",

  // Event logging
  EVENT_CREATED: "event_created",

  // Deal events
  DEAL_CREATED: "deal_created",
  DEAL_CLOSED: "deal_closed",
  DEAL_CANCELLED: "deal_cancelled",

  // Automation events
  AUTOMATION_TRIGGERED: "automation_triggered",

  // KPI events
  KPI_DELTA: "kpi_delta",
  KPI_SNAPSHOT_CREATED: "kpi_snapshot_created",

  // Worker events
  WORKER_STARTED: "worker_started",
  WORKER_COMPLETED: "worker_completed",
  WORKER_FAILED: "worker_failed",

  // Notifications
  NOTIFICATION: "notification",

  // System events
  SYSTEM_HEALTH_CHANGED: "system_health_changed",
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

export interface RealtimeEvent {
  type: EventType;
  timestamp: number;
  orgId?: string;
  [key: string]: any;
}

export interface KpiDeltaEvent extends RealtimeEvent {
  type: typeof EVENTS.KPI_DELTA;
  leadsToday: number;
  dealsToday: number;
  eventsToday: number;
  revenueToday: number;
}

export interface NotificationEvent extends RealtimeEvent {
  type: typeof EVENTS.NOTIFICATION;
  category: "deal" | "automation" | "lead" | "system" | "warning";
  message: string;
  metadata?: Record<string, any>;
}

export interface AutomationTriggeredEvent extends RealtimeEvent {
  type: typeof EVENTS.AUTOMATION_TRIGGERED;
  ruleId: string;
  ruleName: string;
  leadId: string;
  actionType: string;
  message: string;
}

export interface WorkerEvent extends RealtimeEvent {
  workerName: string;
  runAt: string;
  duration?: number;
  error?: string;
}







