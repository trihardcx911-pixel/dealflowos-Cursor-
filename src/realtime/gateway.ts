/**
 * WebSocket Gateway
 * Real-time communication layer for DealflowOS
 */

import WebSocket, { WebSocketServer } from "ws";
import type { Server } from "http";
import { EVENTS, RealtimeEvent } from "./events";

let wss: WebSocketServer | null = null;

// Track connected clients by orgId for targeted broadcasts
const clientsByOrg = new Map<string, Set<WebSocket>>();
const clientMetadata = new WeakMap<WebSocket, { orgId?: string; userId?: string; connectedAt: Date }>();

/**
 * Initialize WebSocket server
 */
export function createWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket, req) => {
    console.log("[ws] Client connected");

    // Parse auth from query params (in production, use proper auth)
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const orgId = url.searchParams.get("orgId") || undefined;
    const userId = url.searchParams.get("userId") || undefined;

    // Store client metadata
    clientMetadata.set(socket, { orgId, userId, connectedAt: new Date() });

    // Track by org for targeted broadcasts
    if (orgId) {
      if (!clientsByOrg.has(orgId)) {
        clientsByOrg.set(orgId, new Set());
      }
      clientsByOrg.get(orgId)!.add(socket);
    }

    // Send connection acknowledgment
    socket.send(
      JSON.stringify({
        type: EVENTS.CONNECTION_ACK,
        timestamp: Date.now(),
        message: "Connected to DealflowOS real-time gateway",
      })
    );

    // Handle incoming messages
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(socket, message);
      } catch (err) {
        console.error("[ws] Invalid message:", err);
      }
    });

    // Handle disconnect
    socket.on("close", () => {
      console.log("[ws] Client disconnected");
      const meta = clientMetadata.get(socket);
      if (meta?.orgId) {
        clientsByOrg.get(meta.orgId)?.delete(socket);
      }
    });

    // Handle errors
    socket.on("error", (err) => {
      console.error("[ws] Socket error:", err);
    });
  });

  console.log("[ws] WebSocket server initialized on /ws");
  return wss;
}

/**
 * Handle messages from clients
 */
function handleClientMessage(socket: WebSocket, message: any): void {
  switch (message.type) {
    case EVENTS.PING:
      socket.send(JSON.stringify({ type: EVENTS.PONG, timestamp: Date.now() }));
      break;

    case "subscribe_org":
      // Allow client to subscribe to a specific org
      const meta = clientMetadata.get(socket);
      if (meta && message.orgId) {
        // Remove from old org
        if (meta.orgId) {
          clientsByOrg.get(meta.orgId)?.delete(socket);
        }
        // Add to new org
        meta.orgId = message.orgId;
        if (!clientsByOrg.has(message.orgId)) {
          clientsByOrg.set(message.orgId, new Set());
        }
        clientsByOrg.get(message.orgId)!.add(socket);
        socket.send(
          JSON.stringify({ type: "subscribed", orgId: message.orgId, timestamp: Date.now() })
        );
      }
      break;

    default:
      // Echo unknown messages back (for debugging)
      socket.send(JSON.stringify({ type: "unknown_message", received: message.type }));
  }
}

/**
 * Broadcast to all connected clients
 */
export function broadcast(event: RealtimeEvent | Record<string, any>): void {
  if (!wss) {
    console.warn("[ws] WebSocket server not initialized");
    return;
  }

  const payload = JSON.stringify({
    ...event,
    timestamp: event.timestamp || Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

/**
 * Broadcast to clients of a specific organization
 */
export function broadcastToOrg(orgId: string, event: RealtimeEvent | Record<string, any>): void {
  const clients = clientsByOrg.get(orgId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    ...event,
    orgId,
    timestamp: event.timestamp || Date.now(),
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

/**
 * Get connection stats
 */
export function getConnectionStats(): {
  totalConnections: number;
  connectionsByOrg: Record<string, number>;
} {
  const connectionsByOrg: Record<string, number> = {};
  
  clientsByOrg.forEach((clients, orgId) => {
    connectionsByOrg[orgId] = clients.size;
  });

  return {
    totalConnections: wss?.clients.size || 0,
    connectionsByOrg,
  };
}

/**
 * Close WebSocket server
 */
export function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (wss) {
      wss.close(() => {
        console.log("[ws] WebSocket server closed");
        resolve();
      });
    } else {
      resolve();
    }
  });
}







