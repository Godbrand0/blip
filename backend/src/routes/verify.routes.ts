import { Router } from "express";
import axios from "axios";
import { ethers } from "ethers";
import { collections } from "../database/db";
import { CONTRACTS } from "../config/contracts";

const router: ReturnType<typeof Router> = Router();

router.get("/verify/:address?", async (req, res) => {
  try {
    const address = (req.params.address || req.query.address) as string;
    
    console.log(`[GET /verify] Checking status for address: ${address}`);

    if (!address) {
      return res.status(400).json({ success: false, error: "Address is required" });
    }

    const normalizedAddress = address.toLowerCase();
    const users = await collections.users;
    const user = await users.findOne({ address: normalizedAddress });

    if (user?.worldIdVerified) {
      console.log(`[GET /verify] User ${normalizedAddress} verified in MongoDB.`);
      return res.status(200).json({ success: true, verified: true });
    }

    // On-chain Check
    try {
      console.log(`[GET /verify] User not in DB. Checking on-chain registry: ${CONTRACTS.HUMAN_REGISTRY.address}`);
      const provider = new ethers.JsonRpcProvider(process.env.WORLD_CHAIN_RPC);
      const registry = new ethers.Contract(
        CONTRACTS.HUMAN_REGISTRY.address,
        CONTRACTS.HUMAN_REGISTRY.abi,
        provider
      );

      const isVerifiedOnChain = await registry.isVerified(normalizedAddress);
      if (isVerifiedOnChain) {
        console.log(`[GET /verify] User ${normalizedAddress} verified on-chain. Syncing to MongoDB...`);
        await users.updateOne(
          { address: normalizedAddress },
          { $set: { worldIdVerified: true, updatedAt: new Date() } },
          { upsert: true }
        );
        return res.status(200).json({ success: true, verified: true });
      } else {
        console.log(`[GET /verify] User ${normalizedAddress} NOT verified on-chain.`);
      }
    } catch (onChainError) {
      console.error("[GET /verify] Error checking on-chain verification:", onChainError);
    }

    return res.status(200).json({ success: true, verified: false });
  } catch (error: any) {
    console.error("[GET /verify] Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    console.log("=== World ID Verification Request ===");
    const { address, ...proof } = req.body;
    console.log("Received address:", address);
    
    const normalizedAddress = address?.toLowerCase();
    const app_id = process.env.WORLD_APP_ID;
    const action = process.env.WORLD_ACTION_ID;

    if (!app_id || !action) {
      console.error("Missing World ID configuration");
      return res.status(500).json({
        success: false,
        error: "World ID configuration missing",
      });
    }

    // Step 1: Database Check
    if (normalizedAddress) {
      const users = await collections.users;
      const user = await users.findOne({ address: normalizedAddress });

      if (user?.worldIdVerified) {
        console.log(`User ${normalizedAddress} already verified in database.`);
        return res.status(200).json({ success: true, already_verified: true });
      }

      // Step 2: On-chain Check (HumanRegistry)
      try {
        const provider = new ethers.JsonRpcProvider(process.env.WORLD_CHAIN_RPC);
        const registry = new ethers.Contract(
          CONTRACTS.HUMAN_REGISTRY.address,
          CONTRACTS.HUMAN_REGISTRY.abi,
          provider
        );

        const isVerifiedOnChain = await registry.isVerified(normalizedAddress);
        if (isVerifiedOnChain) {
          console.log(`User ${normalizedAddress} verified on-chain. Syncing to database...`);
          await users.updateOne(
            { address: normalizedAddress },
            { $set: { worldIdVerified: true, updatedAt: new Date() } },
            { upsert: true }
          );
          return res.status(200).json({ success: true, already_verified: true });
        }
      } catch (onChainError) {
        console.error("Error checking on-chain verification:", onChainError);
      }
    }

    // Step 3: World ID API Verification
    // MiniKit.commands.verify (version 1) returns IDKit v1 format:
    //   { proof, nullifier_hash, merkle_root, verification_level }
    // World ID v1 API accepts this format directly at /api/v1/verify/{app_id}
    // World ID v4 API requires a responses[] array (used only if payload is already v4 format)
    
    const rp_id = process.env.WORLD_RP_ID;
    const proofAction = proof.action || action;

    let verifyRes;
    let apiUrl: string;
    let apiPayload: Record<string, any>;

    if (proof.responses && Array.isArray(proof.responses)) {
      // Payload already in v4 format (newer IDKit/MiniKit version)
      if (!rp_id) {
        return res.status(500).json({ success: false, error: "WORLD_RP_ID missing for v4 verification" });
      }
      apiUrl = `https://developer.world.org/api/v4/verify/${rp_id}`;
      apiPayload = {
        protocol_version: "3.0",
        action: proofAction,
        signal: proof.signal || proof.signal_hash || "",
        responses: proof.responses,
      };
      console.log(`[Step 3] Using v4 API: ${apiUrl}`);
    } else {
      // IDKit v1 format from MiniKit — use v1 API directly, no transformation needed
      apiUrl = `https://developer.worldcoin.org/api/v1/verify/${app_id}`;
      apiPayload = {
        action: proofAction,
        signal: proof.signal || proof.signal_hash || "",
        proof: proof.proof,
        nullifier_hash: proof.nullifier_hash,
        merkle_root: proof.merkle_root,
        verification_level: proof.verification_level || "device",
      };
      console.log(`[Step 3] Using v1 API (IDKit format): ${apiUrl}`);
    }

    console.log("API payload:", JSON.stringify(apiPayload, null, 2));
    try {
      verifyRes = await axios.post(apiUrl, apiPayload);
    } catch (apiError: any) {
      const errorData = apiError?.response?.data || {};
      const statusCode = apiError?.response?.status || 500;
      console.error(`[World ID API] ${statusCode} response:`, JSON.stringify(errorData, null, 2));

      if (errorData.code === "max_verifications_reached" || errorData.code === "already_verified") {
        console.log("User has already verified for this action. Syncing...");
        if (normalizedAddress) {
          const users = await collections.users;
          await users.updateOne(
            { address: normalizedAddress },
            { $set: { worldIdVerified: true, updatedAt: new Date() } },
            { upsert: true }
          );
        }
        return res.status(200).json({
          success: true,
          already_verified: true,
        });
      }

      // Return the World ID API error directly so the frontend can surface it
      return res.status(statusCode).json({
        success: false,
        error: "World ID API rejected the proof",
        code: errorData.code,
        detail: errorData.detail || errorData.message || JSON.stringify(errorData),
      });
    }

    if (verifyRes.status === 200) {
      console.log("Verification successful via API!");
      
      if (normalizedAddress) {
        // Sync to MongoDB
        const users = await collections.users;
        await users.updateOne(
          { address: normalizedAddress },
          { $set: { worldIdVerified: true, updatedAt: new Date() } },
          { upsert: true }
        );

        // PERSIST ON-CHAIN
        try {
          console.log(`Attempting on-chain record for ${normalizedAddress}...`);
          const provider = new ethers.JsonRpcProvider(process.env.WORLD_CHAIN_RPC);
          const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
          const registry = new ethers.Contract(
            CONTRACTS.HUMAN_REGISTRY.address,
            CONTRACTS.HUMAN_REGISTRY.abi,
            wallet
          );

          const tx = await registry.markVerified(normalizedAddress);
          console.log(`On-chain verification TX sent: ${tx.hash}`);
          // We don't necessarily need to wait for confirmation for the user to proceed
        } catch (onChainWriteError) {
          console.error("Failed to persist verification on-chain:", onChainWriteError);
          // Don't fail the request if on-chain write fails, but log it
        }
      }
      
      return res.status(200).json({ success: true, ...verifyRes.data });
    } else {
      return res.status(400).json({ success: false, ...verifyRes.data });
    }
  } catch (error: any) {
    console.error("=== World ID Verification Error ===");
    const errorData = error?.response?.data || {};
    return res.status(error?.response?.status || 500).json({
      success: false,
      error: "Verification failed",
      details: errorData || error.message,
    });
  }
});

export default router;
