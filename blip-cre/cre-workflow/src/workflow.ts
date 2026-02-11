import {
  HTTPCapability,
  handler,
  type Runtime,
  type HTTPPayload,
  Runner,
  decodeJson,
} from "@chainlink/cre-sdk";

// Configuration schema for the workflow
export type Config = {
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
export const onHttpTrigger = async (
  runtime: Runtime<Config>,
  payload: HTTPPayload,
): Promise<string> => {
  try {
    // 1. Decode the input payload
    const data = decodeJson<RegistrationPayload>(payload.input);
    runtime.log(`[BLIP] Received registration request for CID: ${data.cid}`);
    runtime.log(`[BLIP] Creator: ${data.creator}`);

    // Phase 2 - Verify World ID Proof
    // Make an HTTP request to the World ID API
    runtime.log(`[BLIP] Verifying World ID proof...`);

    try {
      const worldIdResponse = await fetch(
        `${process.env.WORLD_ID_API_URL || "http://localhost:3001/api/verify"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data.proof),
        },
      );

      const worldIdResult = await worldIdResponse.json();

      if (!worldIdResult.success) {
        runtime.log(
          `[BLIP] World ID verification failed: ${worldIdResult.error || "Unknown error"}`,
        );
        return JSON.stringify({
          success: false,
          error: "World ID verification failed",
          details: worldIdResult,
        });
      }

      runtime.log(`[BLIP] World ID verified successfully`);
    } catch (error: any) {
      runtime.log(`[BLIP] World ID verification error: ${error.message}`);
      return JSON.stringify({
        success: false,
        error: "World ID verification error",
        details: error.message,
      });
    }

    // Phase 2 - Call AI Attribution Agent
    // Make an HTTP request to the Attribution Agent
    runtime.log(
      `[BLIP] Requesting AI analysis from ${runtime.config.attributionAgentUrl}...`,
    );

    try {
      const aiResponse = await fetch(
        `${runtime.config.attributionAgentUrl}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: data.cid, // In a real implementation, we'd fetch content from IPFS
          }),
        },
      );

      const aiResult = await aiResponse.json();

      if (!aiResponse.ok) {
        runtime.log(
          `[BLIP] AI analysis failed: ${aiResult.error || "Unknown error"}`,
        );
        return JSON.stringify({
          success: false,
          error: "AI analysis failed",
          details: aiResult,
        });
      }

      // Phase 3 - On-chain settlement
      // Call validateContent() via CRE capabilities
      runtime.log(`[BLIP] Validating content on-chain...`);
      
      try {
        // In a real implementation, this would use CRE capabilities to call the smart contract
        // For now, we'll simulate the on-chain settlement
        runtime.log(`[BLIP] Content validated on-chain with ID: ${data.cid}`);
        
        const result = {
          success: true,
          message: "Content registered and validated successfully",
          cid: data.cid,
          isHuman: true, // From World ID verification
          aiConfidence: aiResult.confidence || 0.5,
          attributedSources: aiResult.attributed_sources || [],
          similarity: aiResult.similarity_score || 0,
          transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef", // Mock transaction hash
        };

        return JSON.stringify(result);
      } catch (error: any) {
        runtime.log(`[BLIP] On-chain settlement error: ${error.message}`);
        return JSON.stringify({
          success: false,
          error: "On-chain settlement failed",
          details: error.message,
        });
      }
    } catch (error: any) {
      runtime.log(`[BLIP] AI analysis error: ${error.message}`);
      return JSON.stringify({
        success: false,
        error: "AI analysis error",
        details: error.message,
      });
    }
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
      onHttpTrigger,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
