import express from 'express';
import { Validator } from '@chainlink/external-adapter';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const ATTRIBUTION_AGENT_URL = process.env.ATTRIBUTION_AGENT_URL || 'http://localhost:8000';
const CONFIDENCE_THRESHOLD = 0.70;

const customParams = {
  contentId: ['contentId', 'id'],
  worldIDProof: false, // Optional World ID proof data
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
  const contentId = validator.validated.data.contentId;
  const worldIDProof = validator.validated.data.worldIDProof;
  const content = req.body.data.content; // Content text for analysis

  try {
    // 1. Verify World ID proof
    const isHuman = await verifyWorldID(worldIDProof);

    // 2. Call AI Attribution Agent
    const aiResponse = await axios.post(`${ATTRIBUTION_AGENT_URL}/analyze`, {
      content: content
    });

    const { confidence, attributed_sources, similarity_score } = aiResponse.data;

    // 3. Evaluate results
    const isValidated = confidence >= CONFIDENCE_THRESHOLD;

    const result = {
      jobRunID,
      data: {
        result: isValidated,
        contentId: contentId,
        isHuman: isHuman,
        attribution: attributed_sources,
        similarity: similarity_score
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
