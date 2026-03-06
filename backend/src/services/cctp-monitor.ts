import { collections } from '../database/db';
import { CHAINS } from '../config/chains';
import { CONTRACTS } from '../config/contracts';
import { ethers } from 'ethers';
import { notifyFrontend } from './websocket';

// ── BlipHistory on-chain status updater ────────────────────────────────────
// Status enum mirrors BlipHistory.sol: 0=PENDING, 1=RELAYING, 2=COMPLETED, 3=FAILED

function getRecorderContract() {
  const chainConfig = CHAINS.WORLD_CHAIN;
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, {
    chainId: chainConfig.chainId,
    name: chainConfig.name
  }, { staticNetwork: true });
  
  const signer = new ethers.Wallet(process.env.CRE_PRIVATE_KEY!, provider);
  return new ethers.Contract(
    CONTRACTS.TRANSACTION_RECORDER.address,
    CONTRACTS.TRANSACTION_RECORDER.abi as ethers.InterfaceAbi,
    signer
  );
}

async function updateOnChainStatus(
  intentId: string,
  status: number,
  destTxHashHex: string,
  destChainId: number
): Promise<void> {
  // We always attempt to update status if we have a recordId, 
  // because the TransactionRecorder contract is on World Chain 
  // and it tracks the global state of intents originated from there.

  if (!CONTRACTS.TRANSACTION_RECORDER.address || !process.env.CRE_PRIVATE_KEY) return;

  try {
    const intents = await collections.intents;
    const intent = await intents.findOne(
      { intentId },
      { projection: { onChainRecordId: true, burnTxHash: true } }
    );

    if (!intent) return;

    let recordId = intent.onChainRecordId;

    if (!recordId && intent.burnTxHash) {
       console.log(`[BlipTransactionRecorder] Missing recordId for ${intentId}, attempting discovery...`);
       // Retry discovery a few times if it's missing (race condition)
       for (let i = 0; i < 3; i++) {
         try {
           const recorder = getRecorderContract();
           const filter = recorder.filters.TransactionRecorded(null, intent.user);
           const events = await recorder.queryFilter(filter, -5); // Use 5 blocks to stay safely within Alchemy's 10 block limit
           
           const found = events.find((e: any) => e.args.sourceTxHash.toLowerCase() === intent.burnTxHash.toLowerCase());
           if (found) {
             recordId = (found as any).args.id.toString();
             console.log(`[BlipTransactionRecorder] Discovered recordId ${recordId} for ${intentId}`);
             await intents.updateOne({ intentId }, { $set: { onChainRecordId: recordId } });
             break;
           }
         } catch (discoveryError: any) {
           console.warn(`[BlipTransactionRecorder] Discovery attempt ${i+1} failed:`, discoveryError.message);
         }
         if (i < 2) await new Promise(r => setTimeout(r, 2000)); // Wait 2s between retries
       }
    }

    if (!recordId) {
      console.warn(`[BlipTransactionRecorder] No recordId for intent ${intentId} (even after discovery), skipping updateStatus`);
      return;
    }

    const recorder = getRecorderContract();
    const tx = await recorder.updateStatus(BigInt(recordId), status, destTxHashHex);
    await tx.wait();
    console.log(`[BlipTransactionRecorder] updateStatus(${recordId}, ${status}) confirmed`);
  } catch (e: any) {
    console.error(`[BlipTransactionRecorder] updateStatus failed (non-blocking):`, e.message);
  }
}
async function recordOnChainIfNeeded(intentId: string): Promise<void> {
  if (!CONTRACTS.TRANSACTION_RECORDER.address || !process.env.CRE_PRIVATE_KEY) return;

  try {
    const intents = await collections.intents;
    const intent = await intents.findOne(
      { intentId },
      { projection: { onChainRecordId: true, user: true, amount: true, recipient: true, burnTxHash: true } }
    );

    if (!intent || intent.onChainRecordId) return; // Already recorded

    const recorder = getRecorderContract();
    const burnTxBytes32 = intent.burnTxHash as string; // already 0x + 32 bytes
    const tx = await recorder.recordTransaction(
      intent.user,
      BigInt(intent.amount),
      intent.recipient,
      burnTxBytes32
    );
    const receipt = await tx.wait();

    // Extract the id from the TransactionRecorded event
    let recordId: string | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = recorder.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === 'TransactionRecorded') {
          recordId = parsed.args.id.toString();
          break;
        }
      } catch { /* not this log */ }
    }

    if (recordId) {
      await intents.updateOne({ intentId }, { $set: { onChainRecordId: recordId } });
      console.log(`[BlipTransactionRecorder] recordTransaction confirmed, recordId=${recordId}`);
    }
  } catch (e: any) {
    console.warn(`[BlipTransactionRecorder] recordTransaction failed (non-blocking):`, e.message);
  }
}
// ───────────────────────────────────────────────────────────────────────────

interface CCTPResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  destinationTxHash?: string;
  error?: string;
}

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool success)'
];

export async function monitorAndRelay(
  intentId: string,
  burnTxHash: string,
  sourceChainName: keyof typeof CHAINS = 'WORLD_CHAIN',
  destChainName: keyof typeof CHAINS = 'BASE_SEPOLIA'
): Promise<CCTPResult> {
  console.log(`[CCTP] Monitoring intent ${intentId} from ${sourceChainName} to ${destChainName}`);
  console.log(`[CCTP] Burn tx hash: ${burnTxHash}`);

  try {
    // ── Step 1: Extract MessageSent bytes from burn tx receipt ───────────────
    const sourceProvider = new ethers.JsonRpcProvider(CHAINS[sourceChainName].rpcUrl);
    
    let receipt: ethers.TransactionReceipt | null = null;
    for (let i = 0; i < 3; i++) {
      receipt = await sourceProvider.getTransactionReceipt(burnTxHash);
      if (receipt) break;
      console.log(`[CCTP] Source receipt not found for ${burnTxHash}, retrying ${i+1}/3...`);
      await new Promise(r => setTimeout(r, 5000));
    }

    if (!receipt) throw new Error(`Transaction receipt not found for ${burnTxHash} after 3 attempts`);

    const MESSAGE_SENT_TOPIC = ethers.id('MessageSent(bytes)');
    const transmitterAddress = CHAINS[sourceChainName].messageTransmitter.toLowerCase();

    const messageSentLog = receipt.logs.find(
      log =>
        log.address.toLowerCase() === transmitterAddress &&
        log.topics[0] === MESSAGE_SENT_TOPIC
    );

    if (!messageSentLog) throw new Error('MessageSent event not found in receipt — wrong MessageTransmitter address or wrong tx');

    // ── Step 1.5: Ensure on-chain record exists (backend owns this, not the frontend wallet) ──
    await recordOnChainIfNeeded(intentId); // Await to prevent "Missing recordId" race condition

    let [messageBytes] = ethers.AbiCoder.defaultAbiCoder().decode(['bytes'], messageSentLog.data);
    const messageHash = ethers.keccak256(messageBytes);

    console.log(`[CCTP] Extracted message hash: ${messageHash}`);

    // ── Step 2: Poll Circle's Iris V2 API for attestation ────────────────────
    // Endpoint: GET /v2/messages/{srcDomain}?transactionHash={burnTxHash}
    const IRIS_BASE = process.env.CCTP_ATTESTATION_URL || 'https://iris-api-sandbox.circle.com';
    const srcDomain = CHAINS[sourceChainName].domain;
    const pollUrl = `${IRIS_BASE}/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`;

    console.log(`[CCTP] Iris poll URL: ${pollUrl}`);

    const POLL_INTERVAL_MS = 5000; // 5s between attempts (Circle recommended)
    const MAX_ATTEMPTS = 160;        // ~40 min total (testnet can be slow)

    let attestationHex: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch(pollUrl);

        if (resp.status === 404) {
          console.log(`[CCTP] Attestation not yet observed (404, attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${POLL_INTERVAL_MS / 1000}s...`);
        } else if (resp.status === 429) {
          console.log(`[CCTP] Rate limited (429). Waiting 5 minutes before retrying...`);
          await new Promise(resolve => setTimeout(resolve, 300_000));
          continue;
        } else {
          const data: any = await resp.json();
          const msg = data.messages?.[0];

          if (attempt === 1) {
            console.log(`[CCTP] Iris API first response:`, JSON.stringify(data, null, 2));
          }

          if (msg && msg.status === 'complete' && msg.attestation && msg.attestation !== 'PENDING') {
            attestationHex = msg.attestation;
            // Use the message bytes from Iris rather than the event log, because the
            // event-extracted bytes may have a zero nonce due to encoding differences in
            // CCTP V2, causing "Invalid signature: not attester" when relaying.
            if (msg.message) {
              messageBytes = msg.message;
              console.log(`[CCTP] Using message bytes from Iris API (nonce populated).`);
            }
            console.log(`[CCTP] Attestation ready after ${attempt} attempt(s).`);
            break;
          }

          const finality = msg?.decodedMessage?.minFinalityThreshold;
          const status = msg?.status ?? data?.error ?? 'unknown';
          console.log(`[CCTP] Attestation pending (attempt ${attempt}/${MAX_ATTEMPTS}): status=${status}${finality !== undefined ? `, minFinalityThreshold=${finality}` : ''}. Retrying in ${POLL_INTERVAL_MS / 1000}s...`);
        }
      } catch (fetchErr: any) {
        console.log(`[CCTP] Iris API fetch error (attempt ${attempt}/${MAX_ATTEMPTS}): ${fetchErr.message}. Retrying...`);
      }

      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`Attestation timed out after ${MAX_ATTEMPTS} attempts (~${Math.round(MAX_ATTEMPTS * POLL_INTERVAL_MS / 60_000)} min)`);
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!attestationHex) throw new Error('Attestation unavailable after polling');

    // ── Step 3: Update DB to RELAYING ─────────────────────────────────────────
    const intents = await collections.intents;
    await intents.updateOne(
      { intentId },
      {
        $set: {
          status: 'RELAYING',
          messageBytes,
          messageHash,
          updatedAt: new Date()
        }
      }
    );
    notifyFrontend('intent-relaying', { intentId, messageHash });
    updateOnChainStatus(intentId, 1, ethers.ZeroHash, CHAINS[destChainName].chainId);

    // ── Step 4: Call receiveMessage on destination MessageTransmitter ─────────
    console.log(`[CCTP] Relaying to ${destChainName} via receiveMessage...`);
    const destChainConfig = CHAINS[destChainName];
    const destProvider = new ethers.JsonRpcProvider(destChainConfig.rpcUrl, {
      chainId: destChainConfig.chainId,
      name: destChainConfig.name
    }, { staticNetwork: true });
    const destSigner = new ethers.Wallet(process.env.CRE_PRIVATE_KEY!, destProvider);

    const messageTransmitter = new ethers.Contract(
      CHAINS[destChainName].messageTransmitter,
      MESSAGE_TRANSMITTER_ABI,
      destSigner
    );

    let relayTxHash: string;
    try {
      const tx = await messageTransmitter.receiveMessage(messageBytes, attestationHex);
      console.log(`[CCTP] receiveMessage tx sent: ${tx.hash}`);
      const destReceipt = await tx.wait();
      relayTxHash = destReceipt.hash;
      console.log(`[CCTP] Relay confirmed: ${relayTxHash}`);
    } catch (receiveErr: any) {
      const errMsg = (receiveErr?.message ?? '').toLowerCase();
      const alreadyReceived =
        errMsg.includes('nonce already used') ||
        errMsg.includes('already used') ||
        errMsg.includes('already received') ||
        errMsg.includes('message has been processed') ||
        errMsg.includes('execution reverted') && errMsg.includes('nonce');

      if (!alreadyReceived) throw receiveErr; // let outer catch handle real failures

      // Another relayer (e.g. Circle's auto-relayer) beat us to it — still a success
      console.log(`[CCTP] receiveMessage reverted: message already received by another relayer. Marking COMPLETED.`);
      await intents.updateOne(
        { intentId },
        { $set: { status: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() } }
      );
      notifyFrontend('intent-completed', { intentId, baseTxHash: null });
      updateOnChainStatus(intentId, 2, ethers.ZeroHash, CHAINS[destChainName].chainId);
      return { status: 'SUCCESS' };
    }

    // ── Step 5: Update DB to COMPLETED ────────────────────────────────────────
    await intents.updateOne(
      { intentId },
      {
        $set: {
          status: 'COMPLETED',
          baseTxHash: relayTxHash,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    notifyFrontend('intent-completed', { intentId, baseTxHash: relayTxHash });
    updateOnChainStatus(intentId, 2, relayTxHash, CHAINS[destChainName].chainId);

    return { status: 'SUCCESS', destinationTxHash: relayTxHash };

  } catch (error: any) {
    console.error(`[CCTP] Relay failed for ${intentId}:`, error);

    const intents = await collections.intents;
    await intents.updateOne(
      { intentId },
      {
        $set: {
          status: 'FAILED',
          error: error.message || 'Unknown error during relay',
          updatedAt: new Date()
        }
      }
    );
    notifyFrontend('intent-failed', { intentId, error: error.message || 'Unknown error during relay' });
    updateOnChainStatus(intentId, 3, ethers.ZeroHash, CHAINS[destChainName].chainId);

    return { status: 'FAILED', error: error.message };
  }
}
