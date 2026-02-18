import { GoogleGenerativeAI } from "@google/generative-ai";

interface AttributionSource {
  address: string;
  similarity: number;
}

interface AnalysisResult {
  confidence: number;
  similarity_score: number;
  attributed_sources: AttributionSource[];
  error?: string;
}

// Mock database of existing content and their creators
const CONTENT_DATABASE = [
  { text: "Blockchain is a distributed ledger technology.", creator: "0x123...abc" },
  { text: "AI agents are transforming software development.", creator: "0x456...def" },
  { text: "Chainlink enables trustless off-chain computation.", creator: "0x789...ghi" },
];

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function analyzeContent(content: string): Promise<AnalysisResult> {
  if (!content) {
    return {
      confidence: 0,
      similarity_score: 0,
      attributed_sources: [],
      error: "No content provided",
    };
  }

  const databaseContext = CONTENT_DATABASE
    .map((entry) => `Source: ${entry.creator}\nText: ${entry.text}`)
    .join("\n");

  const prompt = `
    You are an AI Attribution Expert for the BLIP platform.
    Analyze the following 'Submitted Content' against the 'Existing Sources' database.

    Database of Existing Sources:
    ${databaseContext}

    Submitted Content:
    ${content}

    Task:
    1. Identify if the 'Submitted Content' is derived from, similar to, or plagiarized from any of the sources.
    2. Provide a similarity score (0 to 1) where 1 is an exact match.
    3. List the source addresses that are relevant.
    4. Provide a confidence score (0 to 1) for your analysis.

    Return the result strictly in this JSON format:
    {
        "confidence": float,
        "similarity_score": float,
        "attributed_sources": [
            { "address": "string", "similarity": float }
        ]
    }
    `;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(jsonStr);

    return {
      confidence: result.confidence ?? 0,
      similarity_score: result.similarity_score ?? 0,
      attributed_sources: result.attributed_sources ?? [],
    };
  } catch (e) {
    console.error("Gemini Analysis Error:", e);
    return {
      confidence: 0,
      similarity_score: 0,
      attributed_sources: [],
      error: `AI analysis failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
