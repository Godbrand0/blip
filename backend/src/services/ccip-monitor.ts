// src/services/ccip-monitor.ts

import { ethers } from 'ethers';
import { CHAINS } from '../config/chains';
import { logger } from '../utils/logger';

interface CCIPResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  destinationTxHash?: string;
  error?: string;
}

/**
 * Monitor CCIP message status
 * @param messageId CCIP message ID
 * @param destinationChainSelector Destination chain selector
 * @returns Promise<CCIPResult>
 */
export async function monitorCCIPMessage(
  messageId: string,
  destinationChainSelector: string
): Promise<CCIPResult> {
  
  logger.info(`🔍 Monitoring CCIP message: ${messageId}`);
  
  const maxAttempts = 60; // 5 minutes (5s intervals)
  const pollInterval = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    
    try {
      
      // ─────────────────────────────────────────────────────
      // OPTION 1: USE CCIP EXPLORER API
      // ─────────────────────────────────────────────────────
      
      const response = await fetch(
        `https://ccip.chain.link/api/v1/messages/${messageId}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = (await response.json()) as any;
        
        if (data.state === 'SUCCESS') {
          return {
            status: 'SUCCESS',
            destinationTxHash: data.destinationTxHash
          };
        }
        
        if (data.state === 'FAILED') {
          return {
            status: 'FAILED',
            error: data.error || 'CCIP transfer failed'
          };
        }
      }
      
      // ─────────────────────────────────────────────────────
      // OPTION 2: QUERY ON-CHAIN (fallback)
      // ─────────────────────────────────────────────────────
      
      const baseProvider = new ethers.JsonRpcProvider(CHAINS.BASE.rpcUrl);
      
      // Query for ExecutionStateChanged event on Base
      const filter = {
        address: CHAINS.BASE.ccipRouter,
        topics: [
          ethers.id('ExecutionStateChanged(bytes32,uint8,bytes)'),
          messageId
        ],
        fromBlock: -10000, // Last 10k blocks
        toBlock: 'latest'
      };
      
      const logs = await baseProvider.getLogs(filter);
      
      if (logs.length > 0) {
        
        const log = logs[0];
        
        return {
          status: 'SUCCESS',
          destinationTxHash: log.transactionHash
        };
      }
      
      // ─────────────────────────────────────────────────────
      // NOT YET DELIVERED, WAIT AND RETRY
      // ─────────────────────────────────────────────────────
      
      logger.info(
        `⏳ Attempt ${attempt}/${maxAttempts}: Message not yet delivered`
      );
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      logger.error(`Error monitoring CCIP message:`, error);
    }
  }
  
  // Timeout
  return {
    status: 'PENDING',
    error: 'Monitoring timeout - check CCIP Explorer manually'
  };
}
