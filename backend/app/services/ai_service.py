from openai import OpenAI, OpenAIError
from app.core.config import OPENAI_API_KEY
from fastapi import HTTPException

_client = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="OpenAI API key not configured. Set OPENAI_API_KEY in your .env file."
            )
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def generate_description(title: str, vendor: str = None, product_type: str = None, tags: str = None) -> dict:
    context_parts = [f"Product: {title}"]
    if vendor:
        context_parts.append(f"Brand: {vendor}")
    if product_type:
        context_parts.append(f"Category: {product_type}")
    if tags:
        context_parts.append(f"Tags: {tags}")

    prompt = f"""You are an expert e-commerce copywriter for a Shopify dropshipping store.

Based on this product information:
{chr(10).join(context_parts)}

Generate:

1. A compelling, conversion-optimized product description (2-3 paragraphs, use benefit-driven language, create urgency)
2. An SEO-optimized product title (under 60 characters, include high-search-volume keywords)
3. An SEO meta description (under 160 characters, compelling and click-worthy)

Respond in this exact JSON format:
{{
  "description": "...",
  "seo_title": "...",
  "seo_description": "..."
}}"""

    import json
    client = get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def optimize_pricing(title: str, cost_price: float = None, competitor_price: float = None, product_type: str = None) -> dict:
    context_parts = [f"Product: {title}"]
    if cost_price:
        context_parts.append(f"Cost price: ${cost_price}")
    if competitor_price:
        context_parts.append(f"Competitor price: ${competitor_price}")
    if product_type:
        context_parts.append(f"Category: {product_type}")

    prompt = f"""You are an expert e-commerce pricing strategist for dropshipping stores.

Based on this product information:
{chr(10).join(context_parts)}

Analyze and suggest the optimal pricing strategy. Consider:
- Typical dropshipping markup (2x-5x cost)
- Market positioning
- Perceived value
- Profit margins
- Customer willingness to pay

Respond in this exact JSON format:
{{
  "suggested_price": 0.00,
  "markup_percentage": 0,
  "pricing_strategy": "...",
  "reasoning": "..."
}}"""

    import json
    client = get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def analyze_trends(title: str, vendor: str = None, product_type: str = None) -> dict:
    context_parts = [f"Product: {title}"]
    if vendor:
        context_parts.append(f"Brand: {vendor}")
    if product_type:
        context_parts.append(f"Category: {product_type}")

    prompt = f"""You are an expert e-commerce trend analyst for dropshipping.

Analyze this product for trending potential:
{chr(10).join(context_parts)}

Evaluate:
- Current trend score (1-100)
- Demand level (low/medium/high/very high)
- Competition level (low/medium/high/saturated)
- Whether you should sell this product
- Who the target audience is
- Creative marketing angles to promote it

Respond in this exact JSON format:
{{
  "trend_score": 0,
  "demand_level": "...",
  "competition_level": "...",
  "recommendation": "...",
  "target_audience": "...",
  "marketing_angles": ["...", "...", "..."]
}}"""

    import json
    client = get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
