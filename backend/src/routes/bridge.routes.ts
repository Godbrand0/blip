import { Router } from "express";
import axios from "axios";

const router: ReturnType<typeof Router> = Router();

/**
 * @route POST /api/bridge/trigger
 * @desc Triggers the Chainlink CRE workflow to execute a bridge intent.
 */
router.post("/trigger", async (req, res) => {
  const { intentId, user, amount, recipient, destinationChainSelector, proof } = req.body;

  if (!user || !amount || !recipient || !destinationChainSelector || !proof) {
    return res.status(400).json({ error: "Missing required bridging fields" });
  }

  try {
    const creTriggerUrl = process.env.CRE_TRIGGER_URL; // E.g., https://trigger.cre.chain.link/v1/workflows/...
    const creBearerToken = process.env.CRE_BEARER_TOKEN;

    if (!creTriggerUrl) {
      console.warn("CRE_TRIGGER_URL not set, simulating CRE trigger success");
      return res.status(200).json({
        success: true,
        message: "Simulation: CRE trigger successful",
        details: { intentId, user, amount }
      });
    }

    const payload = {
      intentId: intentId || `intent_${Date.now()}`,
      user,
      amount,
      recipient,
      destinationChainSelector,
      proof
    };

    const response = await axios.post(creTriggerUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${creBearerToken}`
      }
    });

    return res.status(200).json({
      success: true,
      creResponse: response.data
    });

  } catch (error: any) {
    console.error("CRE Trigger Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to trigger Chainlink CRE",
      details: error.response?.data || error.message
    });
  }
});

export default router;
