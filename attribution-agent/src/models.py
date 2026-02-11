from pydantic import BaseModel
from typing import List, Optional

class AttributionSource(BaseModel):
    address: str
    similarity: float

class AnalysisRequest(BaseModel):
    content: str

class AnalysisResponse(BaseModel):
    confidence: float
    similarity_score: float
    attributed_sources: List[AttributionSource]
    error: Optional[str] = None