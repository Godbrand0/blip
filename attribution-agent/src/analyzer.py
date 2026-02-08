from fastapi import FastAPI
import uvicorn

app = FastAPI(title="BLIP AI Attribution Agent")

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
    content = request.get("content", "").lower()
    if not content:
        return {"confidence": 0, "attributed_sources": [], "similarity_score": 0}

    attributed_sources = []
    max_similarity = 0

    for entry in CONTENT_DATABASE:
        entry_text = entry["text"].lower()
        # Simple word overlap similarity
        words_input = set(content.split())
        words_entry = set(entry_text.split())
        
        intersection = words_input.intersection(words_entry)
        union = words_input.union(words_entry)
        similarity = len(intersection) / len(union) if union else 0
        
        if similarity > 0.1: # 10% threshold to be considered a source
            attributed_sources.append({
                "address": entry["creator"],
                "similarity": round(similarity, 4)
            })
            if similarity > max_similarity:
                max_similarity = similarity

    # Confidence is higher when similarity is low (meaning it's original) 
    # OR when similarity is extremely high and a source is clearly found.
    # For MVP, we'll just return a fixed high confidence if analysis completes.
    return {
        "confidence": 0.95,
        "attributed_sources": attributed_sources,
        "similarity_score": round(max_similarity, 4)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
