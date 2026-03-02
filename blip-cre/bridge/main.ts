import {
  consensusIdenticalAggregation,
  handler,
  HTTPCapability,
  HTTPClient,
  EVMClient,
  getNetwork,
  type HTTPSendRequester,
  Runner,
  type Runtime,
  type HTTPPayload,
  TxStatus,
  decodeJson,
} from '@chainlink/cre-sdk'
import { encodeFunctionData, type Address } from 'viem'
import { z } from 'zod'

// Configuration schema for the bridge workflow
const configSchema = z.object({
  authorizedEVMAddress: z.string(),
  vaultAddress: z.string(),
  worldIdVerifyUrl: z.string(),
  chainSelectorName: z.string(),
})

type Config = z.infer<typeof configSchema>

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
 * Orchestrates the ChainBridge AI verification and execution flow.
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

      if (response.statusCode !== 200) {
        return { success: false, error: `Identity verification failed with status ${response.statusCode}` };
      }

      const responseText = Buffer.from(response.body).toString('utf-8');
      return JSON.parse(responseText) as { success: boolean; error?: string };
    };

    const worldIdResult = httpClient
      .sendRequest(
        runtime, 
        verifyWorldId, 
        consensusIdenticalAggregation<{ success: boolean; error?: string }>()
      )(runtime.config)
      .result();

    if (!worldIdResult.success) {
      runtime.log(`[ChainBridge] World ID verification failed: ${worldIdResult.error}`);
      return JSON.stringify({
        success: false,
        error: worldIdResult.error || "Identity verification failed",
      });
    }

    runtime.log(`[ChainBridge] World ID verified successfully`);

    // Phase 2: On-chain Bridge Finalization
    runtime.log(`[ChainBridge] Finalizing bridge intent ${data.intentId} on World Chain...`);

    const network = getNetwork({
      chainFamily: 'evm',
      chainSelectorName: runtime.config.chainSelectorName,
      isTestnet: true,
    })

    if (!network) {
      throw new Error(`Network not found for chain selector name: ${runtime.config.chainSelectorName}`)
    }

    const evmClient = new EVMClient(network.chainSelector.selector);
    
    // Encode the contract call data
    const callData = encodeFunctionData({
      abi: [
        {
          "inputs": [
            { "internalType": "address", "name": "user", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "internalType": "address", "name": "recipient", "type": "address" },
            { "internalType": "uint64", "name": "destinationChainSelector", "type": "uint64" }
          ],
          "name": "executeBridgeForUser",
          "outputs": [
            { "internalType": "uint256", "name": "intentId", "type": "uint256" },
            { "internalType": "bytes32", "name": "messageId", "type": "bytes32" }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      functionName: "executeBridgeForUser",
      args: [
        data.user as Address,
        BigInt(data.amount),
        data.recipient as Address,
        10344971235874465080n // Base Sepolia Selector as BigInt
      ],
    });

    const bridgeResult = evmClient
      .sendTransaction(runtime, {
        to: runtime.config.vaultAddress as Address,
        data: callData,
      })
      .result();

    if (bridgeResult.txStatus !== TxStatus.SUCCESS) {
      throw new Error(`Transaction failed: ${bridgeResult.errorMessage || bridgeResult.txStatus}`);
    }

    const result = {
      success: true,
      intentId: data.intentId,
      message: "Bridge transfer finalized and verified by CRE",
      txHash: bridgeResult.txHash ? Buffer.from(bridgeResult.txHash).toString('hex') : "unknown",
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
  const runner = await Runner.newRunner<Config>({
    configSchema,
  });
  await runner.run(initWorkflow);
}
