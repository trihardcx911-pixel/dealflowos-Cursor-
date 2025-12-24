/**
 * React Context Provider for Real-Time Events
 * Provides WebSocket events to the entire app
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { initSocket, closeSocket, onMessage, onConnect, onDisconnect, isConnected } from "./socket";
import { EVENTS, RealtimeEvent, KpiDeltaEvent, NotificationEvent, AutomationTriggeredEvent } from "./events";

interface RealtimeContextValue {
  events: RealtimeEvent[];
  notifications: NotificationEvent[];
  automationEvents: AutomationTriggeredEvent[];
  kpiDelta: KpiDeltaEvent | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  clearNotifications: () => void;
  clearAutomationEvents: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const MAX_EVENTS = 100;
const MAX_NOTIFICATIONS = 50;
const MAX_AUTOMATION_EVENTS = 50;

export function RealtimeProvider({ children, orgId, userId }: { 
  children: React.ReactNode;
  orgId?: string;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [automationEvents, setAutomationEvents] = useState<AutomationTriggeredEvent[]>([]);
  const [kpiDelta, setKpiDelta] = useState<KpiDeltaEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  
  const mountedRef = useRef(true);

  // Handle incoming messages
  const handleMessage = useCallback((event: RealtimeEvent) => {
    if (!mountedRef.current) return;

    // Add to events list
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));

    // Handle specific event types
    switch (event.type) {
      case EVENTS.NOTIFICATION:
        setNotifications((prev) => [event as NotificationEvent, ...prev].slice(0, MAX_NOTIFICATIONS));
        break;

      case EVENTS.AUTOMATION_TRIGGERED:
        setAutomationEvents((prev) => [event as AutomationTriggeredEvent, ...prev].slice(0, MAX_AUTOMATION_EVENTS));
        break;

      case EVENTS.KPI_DELTA:
        setKpiDelta(event as KpiDeltaEvent);
        // Update React Query cache for KPIs
        queryClient.setQueryData(["kpis"], (old: any) => {
          if (!old) return old;
          const delta = event as KpiDeltaEvent;
          return {
            ...old,
            leadsToday: delta.leadsToday,
            dealsToday: delta.dealsToday,
            eventsToday: delta.eventsToday,
            revenueToday: delta.revenueToday,
          };
        });
        break;

      case EVENTS.LEAD_CREATED:
      case EVENTS.LEAD_UPDATED:
      case EVENTS.LEAD_DELETED:
        // Invalidate leads queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        if ((event as any).leadId) {
          queryClient.invalidateQueries({ queryKey: ["lead", (event as any).leadId] });
        }
        break;

      case EVENTS.STATUS_CHANGED:
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["pipelineSummary"] });
        break;

      case EVENTS.DEAL_CREATED:
      case EVENTS.DEAL_CLOSED:
      case EVENTS.DEAL_CANCELLED:
        queryClient.invalidateQueries({ queryKey: ["deals"] });
        queryClient.invalidateQueries({ queryKey: ["kpis"] });
        break;

      case EVENTS.WORKER_STARTED:
      case EVENTS.WORKER_COMPLETED:
      case EVENTS.WORKER_FAILED:
        queryClient.invalidateQueries({ queryKey: ["workerStatus"] });
        break;
    }
  }, [queryClient]);

  // Initialize WebSocket
  useEffect(() => {
    mountedRef.current = true;
    setConnectionStatus("connecting");
    
    initSocket(orgId, userId);

    const unsubMessage = onMessage(handleMessage);
    const unsubConnect = onConnect(() => {
      if (mountedRef.current) setConnectionStatus("connected");
    });
    const unsubDisconnect = onDisconnect(() => {
      if (mountedRef.current) setConnectionStatus("disconnected");
    });

    // Check initial connection
    if (isConnected()) {
      setConnectionStatus("connected");
    }

    return () => {
      mountedRef.current = false;
      unsubMessage();
      unsubConnect();
      unsubDisconnect();
      closeSocket();
    };
  }, [orgId, userId, handleMessage]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearAutomationEvents = useCallback(() => {
    setAutomationEvents([]);
  }, []);

  const value: RealtimeContextValue = {
    events,
    notifications,
    automationEvents,
    kpiDelta,
    connectionStatus,
    clearNotifications,
    clearAutomationEvents,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Hook to access real-time context
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}

/**
 * Hook to subscribe to specific event types
 */
export function useRealtimeEvent<T extends RealtimeEvent>(
  eventType: string,
  callback: (event: T) => void
): void {
  const { events } = useRealtime();
  const lastProcessedRef = useRef<number>(0);

  useEffect(() => {
    const recentEvents = events.filter(
      (e) => e.type === eventType && e.timestamp > lastProcessedRef.current
    );

    if (recentEvents.length > 0) {
      recentEvents.forEach((e) => callback(e as T));
      lastProcessedRef.current = Math.max(...recentEvents.map((e) => e.timestamp));
    }
  }, [events, eventType, callback]);
}







