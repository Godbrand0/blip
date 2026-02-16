// src/services/event-listener.ts

import { ethers } from 'ethers';
import { CHAINS } from '../config/chains';
import { CONTRACTS } from '../config/contracts';
import { monitorCCIPMessage } from './ccip-monitor';
import { notifyFrontend } from './websocket';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';

// Setup provider and contract
const provider = new ethers.JsonRpcProvider(CHAINS.WORLD_CHAIN.rpcUrl);
const vaultContract = new ethers.Contract(
  CONTRACTS.EXECUTION_VAULT.address,
  CONTRACTS.EXECUTION_VAULT.abi,
  provider
);

/**
 * Start listening for IntentCreated events
 */
export async function startEventListener() {
  
  logger.info('🎧 Starting event listener...');
  
  // Listen for IntentCreated events
  vaultContract.on(
    'IntentCreated',
    async (
      intentId: bigint,
      user: string,
      amount: bigint,
      recipient: string,
      destinationChainSelector: bigint,
      ccipMessageId: string,
      timestamp: bigint
    ) => {
      
      logger.info(`🚀 Intent ${intentId} created by ${user}`);
      logger.info(`📨 CCIP Message ID: ${ccipMessageId}`);
      
      try {
        
        // ─────────────────────────────────────────────────────
        // STEP 1: STORE IN DATABASE
        // ─────────────────────────────────────────────────────
        
        await prisma.intent.create({
          data: {
            intentId: intentId.toString(),
            user,
            amount: amount.toString(),
            recipient,
            destinationChainSelector: destinationChainSelector.toString(),
            ccipMessageId,
            status: 'PENDING',
            timestamp: new Date(Number(timestamp) * 1000)
          }
        });
        
        logger.info(`💾 Intent ${intentId} stored in database`);
        
        // ─────────────────────────────────────────────────────
        // STEP 2: NOTIFY FRONTEND (PENDING STATE)
        // ─────────────────────────────────────────────────────
        
        notifyFrontend('intent-pending', {
          intentId: intentId.toString(),
          ccipMessageId,
          ccipExplorerUrl: `https://ccip.chain.link/msg/${ccipMessageId}`
        });
        
        // ─────────────────────────────────────────────────────
        // STEP 3: MONITOR CCIP MESSAGE
        // ─────────────────────────────────────────────────────
        
        const result = await monitorCCIPMessage(
          ccipMessageId,
          destinationChainSelector.toString()
        );
        
        if (result.status === 'SUCCESS') {
          
          logger.info(`✅ CCIP message ${ccipMessageId} delivered`);
          logger.info(`📍 Base tx: ${result.destinationTxHash}`);
          
          // ───────────────────────────────────────────────────
          // STEP 4: MARK EXECUTED ON-CHAIN
          // ───────────────────────────────────────────────────
          
          const signer = new ethers.Wallet(
            process.env.CRE_PRIVATE_KEY!,
            provider
          );
          
          const vaultWithSigner = vaultContract.connect(signer) as any;
          
          const tx = await vaultWithSigner.markExecuted(intentId);
          await tx.wait();
          
          logger.info(`📝 Intent ${intentId} marked executed on-chain`);
          
          // ───────────────────────────────────────────────────
          // STEP 5: UPDATE DATABASE
          // ───────────────────────────────────────────────────
          
          await prisma.intent.update({
            where: { intentId: intentId.toString() },
            data: {
              status: 'COMPLETED',
              baseTxHash: result.destinationTxHash,
              completedAt: new Date()
            }
          });
          
          // ───────────────────────────────────────────────────
          // STEP 6: NOTIFY FRONTEND (SUCCESS)
          // ───────────────────────────────────────────────────
          
          notifyFrontend('intent-completed', {
            intentId: intentId.toString(),
            ccipMessageId,
            baseTxHash: result.destinationTxHash,
            ccipExplorerUrl: `https://ccip.chain.link/msg/${ccipMessageId}`,
            basescanUrl: `${CHAINS.BASE.explorer}/tx/${result.destinationTxHash}`
          });
          
          logger.info(`🎉 Intent ${intentId} completed!`);
          
        } else if (result.status === 'FAILED') {
          
          logger.error(`❌ CCIP message ${ccipMessageId} failed`);
          
          await prisma.intent.update({
            where: { intentId: intentId.toString() },
            data: {
              status: 'FAILED',
              error: result.error
            }
          });
          
          notifyFrontend('intent-failed', {
            intentId: intentId.toString(),
            ccipMessageId,
            error: result.error
          });
        }
        
      } catch (error) {
        logger.error(`Error processing intent ${intentId}:`, error);
      }
    }
  );
  
  logger.info('✅ Event listener started successfully');
}
