/**
 * Real-Time Event Types
 * Shared schema for WebSocket events
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

// Event payload types
export interface BaseEvent {
  type: EventType;
  timestamp: number;
  orgId?: string;
}

export interface LeadUpdatedEvent extends BaseEvent {
  type: typeof EVENTS.LEAD_UPDATED;
  leadId: string;
  payload: any;
}

export interface StatusChangedEvent extends BaseEvent {
  type: typeof EVENTS.STATUS_CHANGED;
  leadId: string;
  oldStatus: string;
  newStatus: string;
}

export interface EventCreatedEvent extends BaseEvent {
  type: typeof EVENTS.EVENT_CREATED;
  leadId: string;
  eventType: string;
  payload: any;
}

export interface AutomationTriggeredEvent extends BaseEvent {
  type: typeof EVENTS.AUTOMATION_TRIGGERED;
  ruleId: string;
  ruleName: string;
  leadId: string;
  actionType: string;
  message: string;
}

export interface KpiDeltaEvent extends BaseEvent {
  type: typeof EVENTS.KPI_DELTA;
  orgId: string;
  leadsToday: number;
  dealsToday: number;
  eventsToday: number;
  revenueToday: number;
}

export interface WorkerRunEvent extends BaseEvent {
  type: typeof EVENTS.WORKER_STARTED | typeof EVENTS.WORKER_COMPLETED | typeof EVENTS.WORKER_FAILED;
  workerName: string;
  runAt: string;
  duration?: number;
  error?: string;
}

export interface NotificationEvent extends BaseEvent {
  type: typeof EVENTS.NOTIFICATION;
  category: "deal" | "automation" | "lead" | "system" | "warning";
  message: string;
  metadata?: Record<string, any>;
}

export type RealtimeEvent =
  | LeadUpdatedEvent
  | StatusChangedEvent
  | EventCreatedEvent
  | AutomationTriggeredEvent
  | KpiDeltaEvent
  | WorkerRunEvent
  | NotificationEvent
  | BaseEvent;







