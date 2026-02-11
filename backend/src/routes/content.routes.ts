import { Router } from "express";
import multer from "multer";
import { blockchainService } from "../services/blockchain.service";
import { paymentService } from "../services/payment.service";
import { ipfsService } from "../services/ipfs.service";
import { x402Validation } from "../middleware/x402.middleware";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to IPFS
    const ipfsResult = await ipfsService.uploadFile(
      req.file.path,
      req.file.originalname,
    );

    // Clean up the temporary file
    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      message: "File uploaded successfully",
      cid: ipfsResult.IpfsHash,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return res.status(500).json({
      error: "Upload failed",
      details: error.message,
    });
  }
});

router.post("/register", async (req, res) => {
  const { contentHash, metadataURI, sources, percentages } = req.body;

  if (!contentHash || !metadataURI || !sources || !percentages) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const receipt = await blockchainService.registerContent(
      contentHash,
      metadataURI,
      sources,
      percentages,
    );
    return res.status(201).json({
      message: "Content registered successfully",
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to register content on-chain",
      details: error.message,
    });
  }
});

/**
 * @route POST /buy/:id
 * @desc Initiates a purchase for a specific content ID.
 */
router.post("/buy/:id", async (req, res) => {
  const { id } = req.params;
  const { payer, amount } = req.body;

  if (!payer) return res.status(400).json({ error: "Payer address required" });

  try {
    // Verify content exists
    const content = await blockchainService.getContent(Number(id));
    if (!content.timestamp)
      return res.status(404).json({ error: "Content not found" });

    // In production, this would trigger an actual financial transaction via Coinbase Commerce
    // For MVP demo, we'll simulate payment and distribute royalties
    const paymentAmount = amount || "0.01"; // Default 0.01 ETH

    // Generate x402 token
    const receipt = paymentService.generateReceipt(Number(id), payer);
    const token = paymentService.encodeToken(receipt);

    // Distribute royalties to attributed sources
    try {
      await blockchainService.distributeRoyalties(Number(id), paymentAmount);
    } catch (royaltyError: any) {
      console.error("Royalty distribution failed:", royaltyError);
      // Continue with payment even if royalty distribution fails
    }

    return res.status(200).json({
      message: "Payment processed successfully",
      token: token,
      receipt: receipt,
      amount: paymentAmount,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: "Payment failed", details: error.message });
  }
});

/**
 * @route GET /:id
 * @desc Returns content details. Protected by x402.
 */
router.get("/:id", x402Validation, async (req, res) => {
  const { id } = req.params;
  try {
    const content = await blockchainService.getContent(Number(id));
    return res.status(200).json(content);
  } catch (error: any) {
    return res
      .status(404)
      .json({ error: "Content not found", details: error.message });
  }
});

export default router;
