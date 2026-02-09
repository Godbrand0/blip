from fastapi import FastAPI
import uvicorn
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BLIP AI Attribution Agent")

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

@app.get("/")
async def root():
    return {"message": "BLIP AI Attribution Agent is running"}

# Mock database of existing content and their creators
CONTENT_DATABASE = [
    {"text": "Blockchain is a distributed ledger technology.", "creator": "0x123...abc"},
    {"text": "AI agents are transforming software development.", "creator": "0x456...def"},
    {"text": "Chainlink enables trustless off-chain computation.", "creator": "0x789...ghi"}
]

@app.post("/analyze")
async def analyze_content(request: dict):
    content = request.get("content", "")
    if not content:
        return {"confidence": 0, "attributed_sources": [], "similarity_score": 0}

    # Prepare context from our "database"
    database_context = "\n".join([f"Source: {entry['creator']}\nText: {entry['text']}" for entry in CONTENT_DATABASE])

    prompt = f"""
    You are an AI Attribution Expert for the BLIP platform.
    Analyze the following 'Submitted Content' against the 'Existing Sources' database.
    
    Database of Existing Sources:
    {database_context}
    
    Submitted Content:
    {content}
    
    Task:
    1. Identify if the 'Submitted Content' is derived from, similar to, or plagiarized from any of the sources.
    2. Provide a similarity score (0 to 1) where 1 is an exact match.
    3. List the source addresses that are relevant.
    4. Provide a confidence score (0 to 1) for your analysis.
    
    Return the result strictly in this JSON format:
    {{
        "confidence": float,
        "similarity_score": float,
        "attributed_sources": [
            {{ "address": "string", "similarity": float }}
        ]
    }}
    """

    try:
        response = model.generate_content(prompt)
        # In a real app, we would parse the JSON strictly. 
        # For MVP, we extract the response text.
        import json
        # Strip potential markdown formatting if Gemini adds it
        json_str = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(json_str)
        return result
    except Exception as e:
        print(f"Gemini Analysis Error: {e}")
        return {
            "confidence": 0.5,
            "attributed_sources": [],
            "similarity_score": 0,
            "error": "Failed to reach Gemini AI"
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
