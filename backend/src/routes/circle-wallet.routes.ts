import { Router } from "express";
import crypto from "crypto";

const router: ReturnType<typeof Router> = Router();

const CIRCLE_API_URL = "https://api.circle.com/v1/w3s";

/**
 * Helper to fetch Circle endpoints with standard authentication
 */
async function callCircleApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = process.env.CIRCLE_API_KEY || "SANDBOX_PLACEHOLDER_KEY";
  const url = `${CIRCLE_API_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${apiKey}`);
  
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Circle API Error] Endpoint: ${endpoint}, Status: ${res.status}, Body:`, errorText);
    throw new Error(`Circle API failed with status ${res.status}: ${errorText}`);
  }

  return res.json();
}

/**
 * @route POST /api/circle/init-user
 * @desc Resolves or registers user, returning a secure session userToken & encryptionKey
 */
router.post("/init-user", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }

  try {
    // 1. Ensure User Entity exists in Circle Web3 Services
    try {
      await callCircleApi("/users", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      console.log(`[Circle] User entity created successfully for ${userId}`);
    } catch (e: any) {
      // Bypassing conflict errors since it indicates user entity already exists
      console.log(`[Circle] User entity check/create completed (either existed or updated): ${userId}`);
    }

    // 2. Fetch User Session Token for client challenge authorization
    const tokenData = await callCircleApi("/users/token", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    return res.status(200).json({
      success: true,
      userToken: tokenData.data.userToken,
      encryptionKey: tokenData.data.encryptionKey,
      refreshToken: tokenData.data.refreshToken,
    });
  } catch (error: any) {
    console.error("[Init User Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to initialize Circle session",
      details: error.message,
    });
  }
});

/**
 * @route POST /api/circle/create-wallet
 * @desc Requests Smart Contract Account (SCA) wallet initialization across testnets
 */
router.post("/create-wallet", async (req, res) => {
  const userToken = req.headers["x-user-token"] as string;

  if (!userToken) {
    return res.status(401).json({ success: false, error: "X-User-Token header is required" });
  }

  try {
    const data = await callCircleApi("/user/initialize", {
      method: "POST",
      headers: {
        "X-User-Token": userToken,
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        accountType: "SCA", // SCA allows sponsored gas station transactions
        blockchains: ["WLD-ETH-SEPOLIA", "BASE-ETH-SEPOLIA"],
      }),
    });

    return res.status(200).json({
      success: true,
      challengeId: data.data.challengeId,
    });
  } catch (error: any) {
    console.error("[Create Wallet Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to trigger wallet creation challenge",
      details: error.message,
    });
  }
});

/**
 * @route GET /api/circle/wallet
 * @desc Retrieves all active wallets associated with a specific userToken
 */
router.get("/wallet", async (req, res) => {
  const userToken = req.headers["x-user-token"] as string;

  if (!userToken) {
    return res.status(401).json({ success: false, error: "X-User-Token header is required" });
  }

  try {
    const data = await callCircleApi("/wallets", {
      method: "GET",
      headers: {
        "X-User-Token": userToken,
      },
    });

    return res.status(200).json({
      success: true,
      wallets: data.data.wallets,
    });
  } catch (error: any) {
    console.error("[Get Wallets Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch wallets",
      details: error.message,
    });
  }
});

/**
 * @route GET /api/circle/wallet/:id/balances
 * @desc Retrieves balances for a specific user wallet
 */
router.get("/wallet/:id/balances", async (req, res) => {
  const { id } = req.params;
  const userToken = req.headers["x-user-token"] as string;

  if (!userToken) {
    return res.status(401).json({ success: false, error: "X-User-Token header is required" });
  }

  try {
    const data = await callCircleApi(`/wallets/${id}/balances`, {
      method: "GET",
      headers: {
        "X-User-Token": userToken,
      },
    });

    return res.status(200).json({
      success: true,
      balances: data.data.tokenBalances,
    });
  } catch (error: any) {
    console.error("[Get Balances Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch wallet balances",
      details: error.message,
    });
  }
});

/**
 * @route POST /api/circle/contract-execution
 * @desc Relays a custom smart contract write action to generate a transaction challenge
 */
router.post("/contract-execution", async (req, res) => {
  const userToken = req.headers["x-user-token"] as string;
  const { walletId, contractAddress, abiFunctionSignature, abiParameters } = req.body;

  if (!userToken) {
    return res.status(401).json({ success: false, error: "X-User-Token header is required" });
  }

  if (!walletId || !contractAddress || !abiFunctionSignature || !abiParameters) {
    return res.status(400).json({ success: false, error: "Missing transaction parameters" });
  }

  try {
    const data = await callCircleApi("/user/transactions/contractExecution", {
      method: "POST",
      headers: {
        "X-User-Token": userToken,
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        walletId,
        contractAddress,
        abiFunctionSignature,
        abiParameters,
        fee: {
          type: "level",
          config: {
            feeLevel: "MEDIUM"
          }
        }
      }),
    });

    return res.status(200).json({
      success: true,
      challengeId: data.data.challengeId,
    });
  } catch (error: any) {
    console.error("[Contract Execution Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to initiate transaction challenge",
      details: error.message,
    });
  }
});

export default router;
