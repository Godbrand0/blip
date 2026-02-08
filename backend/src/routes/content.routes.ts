import { Router } from 'express';
import { blockchainService } from '../services/blockchain.service';

const router = Router();

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
    res.status(201).json({
      message: 'Content registered successfully',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to register content on-chain',
      details: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const content = await blockchainService.getContent(Number(id));
    res.status(200).json(content);
  } catch (error: any) {
    res.status(404).json({ error: 'Content not found', details: error.message });
  }
});

export default router;
