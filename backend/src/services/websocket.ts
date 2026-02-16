// src/services/websocket.ts

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

let io: SocketIOServer;

/**
 * Initialize WebSocket server
 */
export function initWebSocket(httpServer: HTTPServer) {
  
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });
  
  io.on('connection', (socket: any) => {
    logger.info(`🔌 Client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });
  
  logger.info('✅ WebSocket server initialized');
}

/**
 * Notify frontend via WebSocket
 */
export function notifyFrontend(event: string, data: any) {
  if (io) {
    io.emit(event, data);
    logger.info(`📡 Emitted ${event}:`, data);
  }
}
