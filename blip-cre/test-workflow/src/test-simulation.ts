// Mock CRE Host Bindings (Required by SDK)
(globalThis as any).switchModes = () => {};
(globalThis as any).log = (msg: string) => console.log(`[Host] ${msg}`);
(globalThis as any).sendResponse = () => 0;
(globalThis as any).versionV2 = () => {};
(globalThis as any).callCapability = () => 0;
(globalThis as any).awaitCapabilities = () => new Uint8Array();
(globalThis as any).getSecrets = () => ({});
(globalThis as any).awaitSecrets = () => new Uint8Array();
(globalThis as any).getWasiArgs = () => "";
(globalThis as any).now = () => Date.now();

import { onHttpTrigger, type Config } from "./workflow.js";

const mockConfig: Config = {
  authorizedEVMAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  vaultAddress: "0x0000000000000000000000000000000000000000",
  worldIdVerifyUrl: "http://localhost:3001/api/verify",
  attributionAnalyzeUrl: "http://localhost:3001/api/attribution/analyze",
};

const mockRuntime = {
  config: mockConfig,
  log: (msg: string) => console.log(`  ${msg}`),
  now: () => new Date(),
  runInNodeMode: (fn: any, aggregation: any) => {
    // For simulation, just run the function directly
    return (...args: any[]) => {
      const result = fn(mockRuntime, ...args);
      return {
        result: () => result,
      };
    };
  },
  callCapability: (params: any) => {
    return {
      result: () => {
        // Mock HTTP responses based on the URL in the payload
        const url = params.payload.url || "";
        
        if (url.includes("verify")) {
          return {
            statusCode: 200,
            body: new TextEncoder().encode(JSON.stringify({ success: true })),
            headers: {}
          };
        }
        
        if (url.includes("analyze")) {
          return {
            statusCode: 200,
            body: new TextEncoder().encode(JSON.stringify({ 
              confidence: 0.85, 
              similarity_score: 0.9, 
              attributed_sources: [] 
            })),
            headers: {}
          };
        }

        return { statusCode: 404, body: new Uint8Array(), headers: {} };
      }
    };
  }
} as any;

const mockPayload = {
  id: "test_trigger_1",
  timestamp: Date.now(),
  input: new TextEncoder().encode(JSON.stringify({
    intentId: "test_intent_001",
    user: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    amount: "50",
    // ccipMessageId: "msg_test_001", // Removed (using CCTP now)
    content: "This is original content about decentralized identity systems.",
    proof: {
      merkle_root: "0x1234567890abcdef",
      nullifier_hash: "0xabcdef1234567890",
      proof: "0x00000000000000000000",
      verification_level: "orb",
    },
  })),
  headers: {},
};

async function runSimulation() {
  console.log("=== CRE Test Workflow Simulation ===\n");
  console.log("Testing full pipeline: World ID → Attribution → Bridge\n");

  try {
    const result = await onHttpTrigger(mockRuntime, mockPayload);
    const parsed = JSON.parse(result);

    console.log("\n--- Result ---");
    console.log(JSON.stringify(parsed, null, 2));

    if (parsed.success) {
      console.log("\n✅ TEST PASSED: All pipeline phases completed.");
    } else {
      console.error(`\n❌ TEST FAILED at phase: ${parsed.phase || "unknown"}`);
      console.error(`   Error: ${parsed.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ TEST FAILED: Exception thrown:", error);
    process.exit(1);
  }
}

runSimulation();
