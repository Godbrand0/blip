import { 
  HTTPCapability, 
  handler, 
  type Runtime, 
  type HTTPPayload, 
  Runner, 
  decodeJson 
} from "@chainlink/cre-sdk";

// Configuration schema for the workflow
type Config = {
  authorizedEVMAddress: string;
  attributionAgentUrl: string;
};

// Payload expected from the frontend/uploader
type RegistrationPayload = {
  cid: string;
  proof: any; // World ID Proof
  creator: string;
};

/**
 * callback function that runs when an HTTP request is received.
 * This orchestrates the BLIP verification flow.
 */
const onHttpTrigger = async (runtime: Runtime<Config>, payload: HTTPPayload): Promise<string> => {
  try {
    // 1. Decode the input payload
    const data = decodeJson<RegistrationPayload>(payload.input);
    runtime.log(`[BLIP] Received registration request for CID: ${data.cid}`);
    runtime.log(`[BLIP] Creator: ${data.creator}`);

    // TODO: Phase 2 - Verify World ID Proof
    // This would involve making an HTTP request to the World ID API
    runtime.log(`[BLIP] Verifying World ID proof... (Mock: Valid)`);

    // TODO: Phase 2 - Call AI Attribution Agent
    // This would involve making an HTTP request to the Attribution Agent
    runtime.log(`[BLIP] Requesting AI analysis from ${runtime.config.attributionAgentUrl}...`);

    // Placeholder response
    const result = {
      success: true,
      message: "Verification pending",
      cid: data.cid,
      isHuman: true, // Mock result
      aiConfidence: 0.95 // Mock result
    };

    return JSON.stringify(result);

  } catch (error: any) {
    runtime.log(`[BLIP] Error processing request: ${error.message}`);
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
      onHttpTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
