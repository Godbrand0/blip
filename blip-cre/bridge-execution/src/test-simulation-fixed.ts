import { onHttpTrigger, type Config } from "./workflow.js";

// Mock Runtime
const mockRuntime = {
  config: {
    authorizedEVMAddress: "0x1234567890123456789012345678901234567890",
    vaultAddress: "0x1234567890123456789012345678901234567890",
    worldIdVerifyUrl: "http://localhost:4000/api/verify"
  },
  log: (msg: string) => console.log(`[RUNTIME LOG]: ${msg}`),
} as any;

// Mock Payload - matching the BridgeExecutionPayload type
const mockPayload = {
  id: "trigger_1",
  timestamp: Date.now(),
  input: JSON.stringify({
    intentId: "test-intent-123",
    user: "0xUserAddress",
    amount: "1000000000000000000", // 1 ETH in wei
    ccipMessageId: "0xmessageid123",
    proof: { 
      nullifier_hash: "0xnullifier123", 
      proof: "0xproof123",
      merkle_root: "0xmerkle123",
      verification_level: "device"
    }
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
      console.error("Error:", parsed.error);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ TEST FAILED: Exception thrown:", error);
    process.exit(1);
  }
}

runTest();