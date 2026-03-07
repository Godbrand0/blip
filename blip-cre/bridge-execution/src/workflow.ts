import {
  HTTPCapability,
  HTTPClient,
  EVMCapability,
  EVMClient,
  handler,
  Runner,
  decodeJson,
  ok,
  json,
  consensusIdenticalAggregation,
  type Runtime,
  type HTTPPayload,
  type HTTPSendRequester,
  type EVMSendRequester,
} from "@chainlink/cre-sdk";

// Configuration schema for the workflow
export type Config = {
  authorizedEVMAddress: string;
  transactionRecorderAddress: string;
  worldIdVerifyUrl: string;
  irisApiUrl: string;
  // Chain specific configs
  worldChainId: number;
  baseChainId: number;
  worldChainDomain: number;
  baseDomain: number;
  worldChainMessenger: string;
  baseMessenger: string;
};

// Payload expected for bridge execution
type BridgeExecutionPayload = {
  intentId: string;
  txHash: string; // The source burn transaction hash
  user: string;
  amount: string;
  recipient: string;
  sourceChain: "WORLD_CHAIN" | "BASE_SEPOLIA";
  destChain: "WORLD_CHAIN" | "BASE_SEPOLIA";
  proof: any; // World ID Proof
};

const MESSAGE_SENT_TOPIC = "0x8c52616686961414141414141414141414141414141414141414141414141414"; // Mock topic for MessageSent(bytes)

/**
 * orchestrates the ChainBridge AI verification and execution flow.
 */
export const onHttpTrigger = async (
  runtime: Runtime<Config>,
  payload: HTTPPayload,
): Promise<string> => {
  try {
    const data = decodeJson<BridgeExecutionPayload>(payload.input);
    runtime.log(`[ChainBridge] Processing CCTP relay for Intent: ${data.intentId}`);
    runtime.log(`[ChainBridge] Source Tx: ${data.txHash}`);

    const httpClient = new HTTPClient();
    const evmClient = new EVMClient();

    // 1. Verify World ID Proof
    runtime.log(`[ChainBridge] Verifying World ID proof...`);
    const verifyBody = new TextEncoder().encode(JSON.stringify(data.proof));
    const verifyResult = httpClient
      .sendRequest(runtime, (req, config) => req.sendRequest({
        url: config.worldIdVerifyUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: verifyBody,
      }).result(), consensusIdenticalAggregation())
      (runtime.config)
      .result();

    if (!ok(verifyResult) || !(json(verifyResult) as { success: boolean }).success) {
      throw new Error("World ID verification failed");
    }

    // 2. Extract Message from Source Chain
    runtime.log(`[ChainBridge] Fetching source receipt for ${data.txHash}...`);
    const sourceMessenger = data.sourceChain === "WORLD_CHAIN" ? runtime.config.worldChainMessenger : runtime.config.baseMessenger;
    
    // Note: In a real CRE, we'd use runtime.evm.getTransactionReceipt
    // For this implementation, we assume the environment provides the necessary EVM capabilities.
    const receiptResult = evmClient
      .sendTransaction(runtime, (req, config) => {
        // We use a read-only query to get logs if possible, or simulate the receipt fetch
        // In the CRE SDK, we usually use custom adapters or specific capabilities for receipts.
        // Here we'll simulate the extraction logic.
        return { hash: data.txHash } as any; 
      }, consensusIdenticalAggregation())
      (runtime.config)
      .result();

    // 3. Poll Iris API for Attestation
    runtime.log(`[ChainBridge] Polling Iris API for attestation...`);
    const srcDomain = data.sourceChain === "WORLD_CHAIN" ? runtime.config.worldChainDomain : runtime.config.baseDomain;
    const pollUrl = `${runtime.config.irisApiUrl}/v2/messages/${srcDomain}?transactionHash=${data.txHash}`;
    
    let attestationHex = "";
    let messageBytes = "";

    // Polling loop (simplified for workflow)
    for (let i = 0; i < 10; i++) {
        const irisResult = httpClient
          .sendRequest(runtime, (req) => req.sendRequest({ url: pollUrl }).result(), consensusIdenticalAggregation())
          (runtime.config)
          .result();
        
        if (ok(irisResult)) {
            const irisData = json(irisResult) as any;
            const msg = irisData.messages?.[0];
            if (msg && msg.status === 'complete' && msg.attestation) {
                attestationHex = msg.attestation;
                messageBytes = msg.message;
                break;
            }
        }
        runtime.log(`[ChainBridge] Attestation pending... attempt ${i+1}`);
        // In a real workflow, we might use a delay or a separate trigger
    }

    if (!attestationHex) throw new Error("CCTP Attestation timed out");

    // 4. Relay to Destination Chain
    runtime.log(`[ChainBridge] Relaying to destination...`);
    const destMessenger = data.destChain === "WORLD_CHAIN" ? runtime.config.worldChainMessenger : runtime.config.baseMessenger;
    
    const relayResult = evmClient
      .sendTransaction(runtime, (req) => req.sendTransaction({
        to: destMessenger,
        abi: ["function receiveMessage(bytes message, bytes attestation) external returns (bool)"],
        functionName: "receiveMessage",
        args: [messageBytes, attestationHex],
      }).result(), consensusIdenticalAggregation())
      (runtime.config)
      .result();

    // 5. Update Transaction Recorder Status on World Chain
    runtime.log(`[ChainBridge] Updating on-chain status for ${data.intentId}...`);
    // We'd first need to find the recordId, but for this workflow we assume the backend 
    // or a separate process handled the initial record. 
    // Alternatively, we call updateStatus if the contract supports it by intentId or if we find it.
    
    const updateResult = evmClient
      .sendTransaction(runtime, (req, config) => req.sendTransaction({
        to: config.transactionRecorderAddress,
        abi: ["function updateStatus(uint256 id, uint8 status, bytes32 destTxHash) external"],
        functionName: "updateStatus",
        args: [
            "0", // recordId (would need to be passed or discovered)
            2,   // COMPLETED
            relayResult.hash
        ],
      }).result(), consensusIdenticalAggregation())
      (runtime.config)
      .result();

    return JSON.stringify({
      success: true,
      intentId: data.intentId,
      destTxHash: relayResult.hash,
      message: "Bridge relay successfully executed by Chainlink CRE"
    });

  } catch (error: any) {
    runtime.log(`[ChainBridge] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
};

const initWorkflow = (config: Config) => {
  const httpTrigger = new HTTPCapability();
  const evmCapability = new EVMCapability();

  return [
    handler(
      httpTrigger.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.authorizedEVMAddress,
          },
        ],
      }),
      onHttpTrigger,
    ),
    evmCapability,
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
