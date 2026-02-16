import { Router } from "express";
import axios from "axios";

const router: ReturnType<typeof Router> = Router();

router.post("/verify", async (req, res) => {
  try {
    console.log("=== World ID Verification Request ===");
    const proof = req.body;
    console.log("Received proof data:", JSON.stringify(proof, null, 2));

    const app_id = process.env.WORLD_APP_ID;
    const action = process.env.WORLD_ACTION_ID;

    console.log("Environment configuration:");
    console.log(
      "- App ID:",
      app_id ? `${app_id.substring(0, 10)}...` : "NOT SET",
    );
    console.log("- Action ID:", action || "NOT SET");

    if (!app_id || !action) {
      console.error("Missing World ID configuration");
      return res.status(500).json({
        success: false,
        error: "World ID configuration missing",
      });
    }

    const body: Record<string, string> = {
      nullifier_hash: proof.nullifier_hash,
      merkle_root: proof.merkle_root,
      proof: proof.proof,
      verification_level: proof.verification_level,
      action: action,
    };
    if (proof.signal_hash) {
      body.signal_hash = proof.signal_hash;
    }

    console.log("Sending verification request to World ID API...");
    console.log("Request body:", JSON.stringify(body, null, 2));

    const verifyRes = await axios.post(
      `https://developer.worldcoin.org/api/v2/verify/${app_id}`,
      body,
    );

    console.log("World ID API response status:", verifyRes.status);
    console.log(
      "World ID API response data:",
      JSON.stringify(verifyRes.data, null, 2),
    );

    if (verifyRes.status === 200) {
      console.log("Verification successful!");
      return res.status(200).json({ success: true, ...verifyRes.data });
    } else {
      console.log("Verification failed with non-200 status");
      return res.status(400).json({ success: false, ...verifyRes.data });
    }
  } catch (error: any) {
    console.error("=== World ID Verification Error ===");
    console.error("Error details:", error?.response?.data || error.message);
    console.error(
      "Full error object:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );

    const status = error?.response?.status || 500;
    const errorData = error?.response?.data || {};

    // Handle max_verifications_reached as a special case
    if (errorData.code === "max_verifications_reached") {
      console.log(
        "User has already verified for this action - treating as already verified",
      );
      return res.status(200).json({
        success: true,
        already_verified: true,
        message: "User has already verified for this action",
      });
    }

    return res.status(status).json({
      success: false,
      error: "Verification failed",
      details: errorData || error.message,
    });
  }
});

export default router;
