import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  
  if (!apiKey) {
    return NextResponse.json(
      { action: 'error', message: 'Gemini API key is not configured' },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const { message } = await req.json();

    const systemInstruction = `You are a helpful assistant that parses user intents for cross-chain USDC transfers from World Chain to Base.

Extract:
- action: 'send'
- amount: number
- recipient: ethereum address (0x...) OR 'self'
- chain: 'Base'

Rules:
- Destination chain is ALWAYS Base.
- If the user implies bridging to themselves (e.g., "bridge 10 to my wallet", "send 5 usdc", "bridge 2 to me"), set recipient to 'self'.
- Address must start with 0x and be 42 characters long.

If you cannot parse the intent or amount, set action to 'unknown'.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { 
              type: Type.STRING,
              description: "The intended action, usually 'send' for bridging or 'unknown' if unclear."
            },
            amount: { 
              type: Type.NUMBER,
              description: "The numerical amount of USDC to bridge (e.g., 10.5)."
            },
            recipient: { 
              type: Type.STRING,
              description: "The 0x... ethereum address OR the literal string 'self' if the user wants to bridge to their own wallet."
            },
            chain: { 
              type: Type.STRING,
              description: "The target blockchain (usually 'Base')."
            },
            message: { 
              type: Type.STRING,
              description: "A helpful feedback message if the action is 'unknown'."
            },
          },
          required: ["action"]
        }
      }
    });
    
    const text = response.text || '{}';
    const cleanText = text.replace(/```json\n?|\n?```/g, '');
    const parsed = JSON.parse(cleanText);
    
    return NextResponse.json(parsed);
    
  } catch (error) {
    console.error('Gemini AI Error:', error);
    return NextResponse.json(
      { action: 'error', message: 'AI processing failed' },
      { status: 500 }
    );
  }
}
