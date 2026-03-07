import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

router.post("/rp-signature", async (req, res) => {
  try {
    const { signRequest } = await import("@worldcoin/idkit-core/signing");
    const { action } = req.body;
    const signingKey = process.env.WORLD_RP_SIGNING_KEY;

    if (!signingKey) {
      console.error("[RP Signature] WORLD_RP_SIGNING_KEY is not set");
      return res.status(500).json({ success: false, error: "RP signing key not configured" });
    }

    if (!action) {
      return res.status(400).json({ success: false, error: "action is required" });
    }

    console.log(`[RP Signature] Generating signature for action: ${action}`);
    const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey);

    return res.status(200).json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error("[RP Signature] Error generating signature:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
