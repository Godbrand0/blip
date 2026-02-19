// lib/websocket.ts

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Get or create a WebSocket connection to the backend
 * Only works on the client side
 */
export function getSocket(): Socket | null {
  // Check if we're on the client side
  if (typeof window === "undefined") {
    return null;
  }

  if (!socket) {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

    socket = io(backendUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("Connected to backend WebSocket server");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from backend WebSocket server");
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });
  }

  return socket;
}

/**
 * Disconnect the WebSocket connection
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
