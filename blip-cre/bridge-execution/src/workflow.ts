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
  vaultAddress: string;
  worldIdVerifyUrl: string;
};

// Payload expected for bridge execution
type BridgeExecutionPayload = {
  intentId: string;
  user: string;
  amount: string;
  recipient: string;
  ccipMessageId: string;
  proof: any; // World ID Proof
};

/**
 * orchestrates the ChainBridge AI verification and execution flow.
 */
export const onHttpTrigger = async (
  runtime: Runtime<Config>,
  payload: HTTPPayload,
): Promise<string> => {
  try {
    const data = decodeJson<BridgeExecutionPayload>(payload.input);
    runtime.log(`[ChainBridge] Processing execution for Intent: ${data.intentId}`);
    runtime.log(`[ChainBridge] User: ${data.user}, Amount: ${data.amount}`);

    // Phase 1: Verify World ID Proof via CRE HTTPClient
    runtime.log(`[ChainBridge] Verifying World ID proof...`);

    const httpClient = new HTTPClient();
    const verifyBody = new TextEncoder().encode(JSON.stringify(data.proof));

    const verifyWorldId = (sendRequester: HTTPSendRequester, config: Config) => {
      const response = sendRequester
        .sendRequest({
          url: config.worldIdVerifyUrl,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: verifyBody,
        })
        .result();

      if (!ok(response)) {
        return { success: false, error: "Identity verification failed" };
      }

      return json(response) as { success: boolean; error?: string };
    };

    const worldIdResult = httpClient
      .sendRequest(runtime, verifyWorldId, consensusIdenticalAggregation())
      (runtime.config)
      .result();

    if (!worldIdResult.success) {
      runtime.log(`[ChainBridge] World ID verification failed`);
      return JSON.stringify({
        success: false,
        error: worldIdResult.error || "Identity verification failed",
      });
    }

    runtime.log(`[ChainBridge] World ID verified successfully`);

    // Phase 2: On-chain Bridge Finalization
    runtime.log(`[ChainBridge] Finalizing bridge intent ${data.intentId} on World Chain...`);

    const evmClient = new EVMClient();
    
    const executeBridge = (sendRequester: EVMSendRequester, config: Config) => {
      return sendRequester.sendTransaction({
        to: config.vaultAddress,
        abi: [
          "function executeBridgeForUser(address user, uint256 amount, address recipient, uint64 destinationChainSelector) external returns (uint256 intentId, bytes32 messageId)"
        ],
        functionName: "executeBridgeForUser",
        args: [
          data.user,
          data.amount,
          data.recipient,
          "16015286601757825753" // Base Sepolia Selector (Mock/Example)
        ],
      }).result();
    };

    const bridgeResult = evmClient
      .sendTransaction(runtime, executeBridge, consensusIdenticalAggregation())
      (runtime.config)
      .result();

    const result = {
      success: true,
      intentId: data.intentId,
      message: "Bridge transfer finalized and verified by CRE",
      txHash: bridgeResult.hash,
    };

    return JSON.stringify(result);

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
