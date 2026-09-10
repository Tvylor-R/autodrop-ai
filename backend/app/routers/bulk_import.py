import csv
import io
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import User
from app.database.store_model import Store
from app.database.product_model import Product
from app.core.dependencies import get_current_user
from app.integrations.shopify import create_product

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/import",
    tags=["Bulk Import"]
)

CSV_COLUMNS = ["title", "vendor", "price", "cost", "sku", "product_type", "tags", "body_html", "status"]
MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_ROWS = 200


def _get_store(db: Session, shop: str) -> Store:
    store = db.query(Store).filter(Store.shop_domain == shop).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if not store.access_token:
        raise HTTPException(status_code=400, detail="Store not connected via OAuth")
    return store


def _save_local_product(db: Session, store_id: int, product: dict, cost: float = None) -> Product:
    external_id = str(product.get("id"))
    db_product = (
        db.query(Product)
        .filter(Product.shopify_product_id == external_id)
        .first()
    )

    if db_product:
        db_product.title = product.get("title")
        db_product.vendor = product.get("vendor")
        db_product.status = product.get("status", "active")
        if cost is not None:
            db_product.cost = cost
        db.commit()
        db.refresh(db_product)
        return db_product

    db_product = Product(
        store_id=store_id,
        shopify_product_id=external_id,
        title=product.get("title"),
        vendor=product.get("vendor"),
        status=product.get("status", "active"),
        cost=cost,
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.get("/template")
def import_template():
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    writer.writerow(
        {
            "title": "Example Product",
            "vendor": "Your Brand",
            "price": "19.99",
            "cost": "8.50",
            "sku": "EXMP-001",
            "product_type": "Apparel",
            "tags": "new,trending",
            "body_html": "<p>Short product description</p>",
            "status": "active",
        }
    )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_template.csv"},
    )


@router.post("/products")
async def import_products(
    shop: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    store = _get_store(db, shop)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")

    try:
        text = content.decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text)))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    if len(rows) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"Too many rows (max {MAX_ROWS})")

    imported = []
    failed = []
    for index, row in enumerate(rows, start=2):
        title = (row.get("title") or "").strip()
        if not title:
            failed.append(
                {"row": index, "title": "", "status": "failed", "error": "Missing title"}
            )
            continue

        variants = [{"price": (row.get("price") or "0.00").strip() or "0.00"}]
        sku = (row.get("sku") or "").strip()
        if sku:
            variants[0]["sku"] = sku

        cost_raw = (row.get("cost") or "").strip()
        cost = None
        if cost_raw:
            try:
                cost = float(cost_raw)
            except ValueError:
                failed.append(
                    {
                        "row": index,
                        "title": title,
                        "status": "failed",
                        "error": f"Invalid cost: {cost_raw}",
                    }
                )
                continue

        try:
            product = create_product(
                shop,
                store.access_token,
                title=title,
                body_html=(row.get("body_html") or "").strip(),
                vendor=(row.get("vendor") or "").strip() or None,
                product_type=(row.get("product_type") or "").strip() or None,
                tags=(row.get("tags") or "").strip(),
                variants=variants,
            )
        except Exception as e:
            logger.warning(f"Import row {index} failed: {e}")
            failed.append(
                {"row": index, "title": title, "status": "failed", "error": str(e)}
            )
            continue

        _save_local_product(db, store.id, product, cost=cost)
        imported.append(
            {
                "row": index,
                "title": title,
                "shopify_product_id": product.get("id"),
                "status": product.get("status", "active"),
            }
        )

    return {
        "total": len(rows),
        "imported": len(imported),
        "failed": len(failed),
        "imports": imported,
        "errors": failed,
    }