import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
  });
  
  try {
    
    const { message } = await req.json();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Using latest model
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that parses user intents for cross-chain USDC transfers from World Chain to Base.

Extract:
- action: 'send'
- amount: number (USDC amount)
- recipient: ethereum address (0x...)
- chain: 'Base'

Rules:
- Destination chain is ALWAYS Base for this MVP.
- Amount should be a raw number.
- Address must start with 0x and be 42 characters long.

Respond ONLY with JSON:
{
  "action": "send",
  "amount": 50,
  "recipient": "0x...",
  "chain": "Base"
}

If you cannot parse, respond:
{
  "action": "unknown",
  "message": "I couldn't quite understand that. Please specify the amount and recipient address (e.g., 'Send 10 USDC to 0x...')"
}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });
    
    const aiResponse = completion.choices[0].message.content;
    const parsed = JSON.parse(aiResponse || '{}');
    
    return NextResponse.json(parsed);
    
  } catch (error) {
    console.error('AI Error:', error);
    return NextResponse.json(
      { action: 'error', message: 'AI processing failed' },
      { status: 500 }
    );
  }
}
