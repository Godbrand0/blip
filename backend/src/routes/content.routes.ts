import { Router } from 'express';
import multer from 'multer';
import { blockchainService } from '../services/blockchain.service';
import { paymentService } from '../services/payment.service';
import { ipfsService } from '../services/ipfs.service';
import { x402Validation } from '../middleware/x402.middleware';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/register', async (req, res) => {
  const { contentHash, metadataURI, sources, percentages } = req.body;

  if (!contentHash || !metadataURI || !sources || !percentages) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const receipt = await blockchainService.registerContent(
      contentHash,
      metadataURI,
      sources,
      percentages
    );
    return res.status(201).json({
      message: 'Content registered successfully',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to register content on-chain',
      details: error.message
    });
  }
});

/**
 * @route POST /buy/:id
 * @desc Initiates a purchase for a specific content ID.
 */
router.post('/buy/:id', async (req, res) => {
  const { id } = req.params;
  const { payer } = req.body;

  if (!payer) return res.status(400).json({ error: 'Payer address required' });

  try {
    // Verify content exists
    const content = await blockchainService.getContent(Number(id));
    if (!content.timestamp) return res.status(404).json({ error: 'Content not found' });

    // In production, this would trigger an actual financial transaction.
    // Here we generate the x402 token directly for the MVP demo.
    const receipt = paymentService.generateReceipt(Number(id), payer);
    const token = paymentService.encodeToken(receipt);

    return res.status(200).json({
      message: 'Payment processed successfully',
      token: token,
      receipt: receipt
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Payment failed', details: error.message });
  }
});

/**
 * @route GET /:id
 * @desc Returns content details. Protected by x402.
 */
router.get('/:id', x402Validation, async (req, res) => {
  const { id } = req.params;
  try {
    const content = await blockchainService.getContent(Number(id));
    return res.status(200).json(content);
  } catch (error: any) {
    return res.status(404).json({ error: 'Content not found', details: error.message });
  }
});

export default router;
