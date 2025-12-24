/**
 * WebSocket Client
 * Manages connection to DealflowOS real-time gateway
 */

import { RealtimeEvent } from "./events";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;

type MessageCallback = (event: RealtimeEvent) => void;
type ConnectionCallback = () => void;

const messageCallbacks: Set<MessageCallback> = new Set();
const connectCallbacks: Set<ConnectionCallback> = new Set();
const disconnectCallbacks: Set<ConnectionCallback> = new Set();

/**
 * Initialize WebSocket connection
 */
export function initSocket(orgId?: string, userId?: string): WebSocket {
  // Build URL with query params
  let url = WS_URL;
  const params = new URLSearchParams();
  if (orgId) params.set("orgId", orgId);
  if (userId) params.set("userId", userId);
  if (params.toString()) url += `?${params.toString()}`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log("[ws] Connected to real-time gateway");
    reconnectAttempts = 0;
    connectCallbacks.forEach((cb) => cb());
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as RealtimeEvent;
      messageCallbacks.forEach((cb) => cb(data));
    } catch (err) {
      console.error("[ws] Failed to parse message:", err);
    }
  };

  socket.onclose = (event) => {
    console.log("[ws] Disconnected", event.code, event.reason);
    disconnectCallbacks.forEach((cb) => cb());

    // Auto-reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectTimeout = setTimeout(() => {
        reconnectAttempts++;
        console.log(`[ws] Reconnecting... (attempt ${reconnectAttempts})`);
        initSocket(orgId, userId);
      }, RECONNECT_DELAY * Math.min(reconnectAttempts + 1, 5));
    }
  };

  socket.onerror = (err) => {
    console.error("[ws] WebSocket error:", err);
  };

  return socket;
}

/**
 * Close WebSocket connection
 */
export function closeSocket(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
  if (socket) {
    socket.close();
    socket = null;
  }
}

/**
 * Subscribe to messages
 */
export function onMessage(callback: MessageCallback): () => void {
  messageCallbacks.add(callback);
  return () => messageCallbacks.delete(callback);
}

/**
 * Subscribe to connection events
 */
export function onConnect(callback: ConnectionCallback): () => void {
  connectCallbacks.add(callback);
  return () => connectCallbacks.delete(callback);
}

/**
 * Subscribe to disconnection events
 */
export function onDisconnect(callback: ConnectionCallback): () => void {
  disconnectCallbacks.add(callback);
  return () => disconnectCallbacks.delete(callback);
}

/**
 * Send message to server
 */
export function sendMessage(message: Record<string, any>): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn("[ws] Cannot send message - socket not connected");
  }
}

/**
 * Subscribe to a specific organization
 */
export function subscribeToOrg(orgId: string): void {
  sendMessage({ type: "subscribe_org", orgId });
}

/**
 * Check if connected
 */
export function isConnected(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}

/**
 * Get connection state
 */
export function getConnectionState(): "connecting" | "connected" | "disconnected" {
  if (!socket) return "disconnected";
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return "connecting";
    case WebSocket.OPEN:
      return "connected";
    default:
      return "disconnected";
  }
}







