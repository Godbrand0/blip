import express from 'express';
import { Validator } from '@chainlink/external-adapter';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const WORLD_ID_VERIFY_URL = process.env.WORLD_ID_VERIFY_URL || 'http://localhost:3001/api/verify';

const customParams = {
  intentId: ['intentId', 'id'],
  worldIDProof: true,
  endpoint: false,
};

// Mock World ID verification function
const verifyWorldID = async (proofData: any): Promise<boolean> => {
  if (!proofData) return false;
  // In a real implementation, this would call the World ID Developer Portal API
  // e.g., https://developer.worldcoin.org/api/v2/verify/app_id
  console.log('[cre-adapter] Verifying World ID proof:', proofData);
  return true; // Mock success
};

app.post('/', async (req, res) => {
  const validator = new Validator(req.body, customParams);
  if (validator.error) return res.status(400).send(validator.error);

  const jobRunID = req.body.id;
  const intentId = validator.validated.data.intentId;
  const worldIDProof = validator.validated.data.worldIDProof;

  try {
    // 1. Verify World ID proof via Blip Backend
    const verifyRes = await axios.post(WORLD_ID_VERIFY_URL, worldIDProof);
    const isHuman = verifyRes.data.success;

    // 2. Mock Bridge validation (Phase 3 in workflow)
    const isValidated = isHuman;

    const result = {
      jobRunID,
      data: {
        result: isValidated,
        intentId: intentId,
        isHuman: isHuman,
        status: isValidated ? 'validated' : 'failed'
      },
      statusCode: 200
    };

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ jobRunID, status: 'errored', error: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`[cre-adapter]: Listening on port ${port}`));
