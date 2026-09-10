from pydantic import BaseModel
from typing import Optional


class DescriptionRequest(BaseModel):
    title: str
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    tags: Optional[str] = None


class DescriptionResponse(BaseModel):
    description: str
    seo_title: str
    seo_description: str


class PricingRequest(BaseModel):
    title: str
    cost_price: Optional[float] = None
    competitor_price: Optional[float] = None
    product_type: Optional[str] = None


class PricingResponse(BaseModel):
    suggested_price: float
    markup_percentage: float
    pricing_strategy: str
    reasoning: str


class TrendRequest(BaseModel):
    title: str
    vendor: Optional[str] = None
    product_type: Optional[str] = None


class TrendResponse(BaseModel):
    trend_score: int
    demand_level: str
    competition_level: str
    recommendation: str
    target_audience: str
    marketing_angles: list[str]
