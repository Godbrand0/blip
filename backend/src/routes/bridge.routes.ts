import { Router } from "express";
import { monitorAndRelay } from "../services/cctp-monitor";
import { collections } from "../database/db";

const router: ReturnType<typeof Router> = Router();

/**
 * @route GET /api/bridge/stats
 * @desc Returns global stats for the bridge landing page, including total transfers, volume, and live explorer feed.
 */
router.get("/stats", async (req, res) => {
  try {
    const intents = await collections.intents;
    
    // 1. Total and completed counts
    const totalBridges = await intents.countDocuments({});
    const completedBridges = await intents.countDocuments({ status: "COMPLETED" });

    // 2. Sum up total volume bridged (in USDC)
    const volumeAgg = await intents.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: null,
          totalRaw: { $sum: { $toDouble: "$amount" } }
        }
      }
    ]).toArray();
    const totalUsdcBridged = volumeAgg.length > 0 ? volumeAgg[0].totalRaw / 1e6 : 0;

    // 3. Destination chains popularity
    const destChainsAgg = await intents.aggregate([
      {
        $group: {
          _id: "$destChain",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    const topTarget = destChainsAgg.length > 0 
      ? (destChainsAgg[0]._id === "WORLD_CHAIN" ? "World Chain Sepolia" : "Base Sepolia") 
      : "Base Sepolia";

    // 4. Fetch 10 most recent global transfers for explorer feed
    const recentIntents = await intents.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const maskAddress = (addr: string) => {
      if (!addr) return "0x0000...0000";
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const recentBridges = recentIntents.map(intent => {
      const amtNum = parseFloat(intent.amount || "0") / 1e6;
      return {
        intentId: intent.intentId,
        userMasked: maskAddress(intent.user),
        recipientMasked: maskAddress(intent.recipient),
        amount: amtNum,
        status: intent.status,
        sourceChain: intent.sourceChain || "WORLD_CHAIN",
        destChain: intent.destChain || "BASE_SEPOLIA",
        burnTxHash: intent.burnTxHash || "",
        destTxHash: intent.baseTxHash || "",
        timestamp: intent.createdAt || intent.timestamp || new Date()
      };
    });

    return res.status(200).json({
      success: true,
      totalBridges,
      completedBridges,
      totalUsdcBridged,
      topTarget,
      recentBridges
    });
  } catch (error: any) {
    console.error("Stats Aggregation Error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to load bridge statistics",
      details: error.message
    });
  }
});

/**
 * @route POST /api/bridge/relay
 * @desc Accepts a burnTxHash from World Chain, verifies intent, and triggers background relay to Base Sepolia.
 */
router.post("/relay", async (req, res) => {
  console.log("[Relay] Incoming request body:", JSON.stringify(req.body, null, 2));
  const { txHash, user, amount, recipient, proof, recordId, sourceChain, destChain } = req.body;

  if (!txHash || !user || !amount || !recipient) {
    return res.status(400).json({ error: "Missing required bridging fields" });
  }

  try {
    const users = await collections.users;
    const dbUser = await users.findOne({ address: user.toLowerCase() });

    // 2. Generate unique intentId
    const intentId = `intent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 3. Store intent in DB
    const intents = await collections.intents;
    await intents.insertOne({
      intentId,
      user: user.toLowerCase(),
      amount: amount.toString(),
      recipient: recipient.toLowerCase(),
      burnTxHash: txHash,
      status: "PENDING",
      timestamp: new Date(),
      onChainRecordId: recordId ? recordId.toString() : null,
      sourceChain: sourceChain || 'WORLD_CHAIN',
      destChain: destChain || 'BASE_SEPOLIA',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 4. Trigger background relay (don't await)
    monitorAndRelay(intentId, txHash, sourceChain || 'WORLD_CHAIN', destChain || 'BASE_SEPOLIA').then(result => {
      console.log(`[Relay] Background process finished for ${intentId}: ${result.status}`);
    }).catch(err => {
      console.error(`[Relay] Background process failed for ${intentId}:`, err);
    });

    // 5. Respond immediately to frontend
    return res.status(200).json({
      success: true,
      intentId,
      status: "PENDING",
      message: "Bridge intent registered. Relaying in progress..."
    });

  } catch (error: any) {
    console.error("Bridge Relay Error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to register bridge intent",
      details: error.message
    });
  }
});

/**
 * @route POST /api/bridge/retry/:intentId
 * @desc Re-triggers relay for a PENDING or FAILED intent (e.g. stuck attestation).
 */
router.post("/retry/:intentId", async (req, res) => {
  const { intentId } = req.params;

  try {
    const intents = await collections.intents;
    const intent = await intents.findOne({ intentId });

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    if (intent.status === "RELAYING" || intent.status === "COMPLETED") {
      return res.status(400).json({
        error: `Cannot retry intent with status: ${intent.status}`,
      });
    }

    // Reset to PENDING so the monitor starts fresh
    await intents.updateOne(
      { intentId },
      { $set: { status: "PENDING", error: undefined, updatedAt: new Date() } }
    );

    monitorAndRelay(
      intentId,
      intent.burnTxHash,
      (intent as any).sourceChain || "WORLD_CHAIN",
      (intent as any).destChain || "BASE_SEPOLIA"
    )
      .then((result) => {
        console.log(`[Relay] Retry finished for ${intentId}: ${result.status}`);
      })
      .catch((err) => {
        console.error(`[Relay] Retry failed for ${intentId}:`, err);
      });

    return res.status(200).json({
      success: true,
      intentId,
      status: "PENDING",
      message: "Retry triggered. Polling attestation...",
    });
  } catch (error: any) {
    console.error("Retry Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/bridge/status/:intentId
 * @desc Returns current status and any available transaction hashes for an intent.
 */
router.get("/status/:intentId", async (req, res) => {
  const { intentId } = req.params;
  try {
    const intents = await collections.intents;
    const intent = await intents.findOne({ intentId });

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    return res.status(200).json({
      success: true,
      status: intent.status,
      burnTxHash: intent.burnTxHash,
      destTxHash: intent.baseTxHash || null, // baseTxHash is used for the destination tx
      error: intent.error || null
    });
  } catch (error: any) {
    console.error("Status Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
