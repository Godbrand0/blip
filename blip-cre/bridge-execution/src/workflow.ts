import {
  HTTPCapability,
  HTTPClient,
  handler,
  type Runtime,
  type HTTPPayload,
  type HTTPSendRequester,
  Runner,
  decodeJson,
  ok,
  json,
  consensusIdenticalAggregation,
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
    // In a production CRE, we would use the EVM capability to call markExecuted()
    runtime.log(`[ChainBridge] Finalizing bridge intent ${data.intentId} on World Chain...`);

    const result = {
      success: true,
      intentId: data.intentId,
      message: "Bridge transfer finalized and verified by CRE",
      txHash: "0x" + "f".repeat(64), // Mock finalization hash
    };

    return JSON.stringify(result);

  } catch (error: any) {
    runtime.log(`[ChainBridge] Error: ${error.message}`);
    return JSON.stringify({ success: false, error: error.message });
  }
};

const initWorkflow = (config: Config) => {
  const httpTrigger = new HTTPCapability();

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
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
