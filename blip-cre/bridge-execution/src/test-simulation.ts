import { onHttpTrigger, type Config } from "./workflow.js";

// Mock Runtime
const mockRuntime = {
  config: {
    authorizedEVMAddress: "0x1234567890123456789012345678901234567890",
    attributionAgentUrl: "http://localhost:8000"
  },
  log: (msg: string) => console.log(`[RUNTIME LOG]: ${msg}`),
} as any;

// Mock Payload
const mockPayload = {
  id: "trigger_1",
  timestamp: Date.now(),
  input: JSON.stringify({
    cid: "QmTestCID",
    proof: { nullifier_hash: "0x...", proof: "0x..." },
    creator: "0xUserAddress"
  }),
  headers: {}
};

async function runTest() {
  console.log("Starting Workflow Simulation Test...");
  try {
    const result = await onHttpTrigger(mockRuntime, mockPayload);
    console.log("Workflow Execution Result:", result);
    
    const parsed = JSON.parse(result);
    if (parsed.success) {
      console.log("✅ TEST PASSED: Workflow returned success.");
    } else {
      console.error("❌ TEST FAILED: Workflow returned failure.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ TEST FAILED: Exception thrown:", error);
    process.exit(1);
  }
}

runTest();
