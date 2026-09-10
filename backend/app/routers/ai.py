from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.database.models import User
from app.schemas.ai import (
    DescriptionRequest,
    DescriptionResponse,
    PricingRequest,
    PricingResponse,
    TrendRequest,
    TrendResponse,
)
from app.services.ai_service import (
    generate_description,
    optimize_pricing,
    analyze_trends,
)

router = APIRouter(
    prefix="/ai",
    tags=["AI"]
)


@router.post("/describe", response_model=DescriptionResponse)
def ai_describe(
    request: DescriptionRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = generate_description(
            request.title,
            request.vendor,
            request.product_type,
            request.tags,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/price", response_model=PricingResponse)
def ai_price(
    request: PricingRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = optimize_pricing(
            request.title,
            request.cost_price,
            request.competitor_price,
            request.product_type,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI pricing failed: {str(e)}")


@router.post("/trends", response_model=TrendResponse)
def ai_trends(
    request: TrendRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = analyze_trends(
            request.title,
            request.vendor,
            request.product_type,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI trend analysis failed: {str(e)}")
