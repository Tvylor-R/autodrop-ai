from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, get_current_user, get_user_store
from app.database.models import User
from app.database.store_model import Store
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.services.product_service import (
    get_products,
    get_product,
    create_product,
    update_product,
    delete_product,
)

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)


@router.get("/", response_model=List[ProductResponse])
def list_products(
    shop: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    store = get_user_store(db, current_user, shop)
    return get_products(db, store.id)


@router.get("/{product_id}", response_model=ProductResponse)
def read_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def add_product(
    shop: str,
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    store = get_user_store(db, current_user, shop)
    return create_product(
        db,
        store.id,
        product.shopify_product_id,
        product.title,
        product.vendor,
        product.status,
        product.cost,
        product.shopify_variant_id,
    )


@router.put("/{product_id}", response_model=ProductResponse)
def modify_product(
    product_id: int,
    product: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated = update_product(
        db,
        product_id,
        product.title,
        product.vendor,
        product.status,
        product.cost,
        product.shopify_variant_id,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found")
    return updated


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not delete_product(db, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
