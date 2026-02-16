// src/index.ts

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { startEventListener } from './services/event-listener';
import { initWebSocket } from './services/websocket';
import { logger } from './utils/logger';
import { prisma } from './database/client';
import verifyRoutes from './routes/verify.routes';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════

app.use('/api', verifyRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/intents/:intentId', async (req, res) => {
  try {
    const { intentId } = req.params;
    const intent = await prisma.intent.findUnique({
      where: { intentId }
    });
    
    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }
    
    res.json(intent);
    return;
  } catch (error) {
    logger.error('Error fetching intent:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

async function main() {
  
  // Initialize WebSocket
  initWebSocket(httpServer);
  
  // Start event listener
  await startEventListener();
  
  // Start HTTP server
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
