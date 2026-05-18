// src/index.ts
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initWebSocket } from './services/websocket';
import { logger } from './utils/logger';
import { connectToDatabase, collections } from './database/db';
import bridgeRoutes from './routes/bridge.routes';
import circleWalletRoutes from './routes/circle-wallet.routes';

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

app.use('/api/bridge', bridgeRoutes);
app.use('/api/circle', circleWalletRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/intents/:intentId', async (req, res) => {
  try {
    const { intentId } = req.params;
    const intents = await collections.intents;
    const intent = await intents.findOne({ intentId });
    
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

app.get('/api/intents/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const intentsCollection = await collections.intents;
    const intents = await intentsCollection.find({ user: address }).sort({ createdAt: -1 }).toArray();
    
    res.json(intents);
  } catch (error) {
    logger.error('Error fetching user intents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

async function main() {
  // Ensure DB connection
  try {
    await connectToDatabase();
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  // Start HTTP server immediately
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });

  // Initialize background services
  try {
    // Initialize WebSocket
    initWebSocket(httpServer);
  } catch (error) {
    logger.error('Error initializing background services:', error);
  }
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
