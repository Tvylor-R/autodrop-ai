# AutoDrop AI - Backend

FastAPI backend for the AutoDrop AI Shopify dropshipping automation platform.

## Architecture

```
app/
├── core/
│   ├── config.py          # Environment configuration
│   ├── security.py        # JWT tokens & password hashing
│   ├── dependencies.py    # Auth dependencies
│   └── middleware.py      # Request logging & security headers
├── database/
│   ├── database.py        # SQLAlchemy engine/session
│   ├── models.py          # User model
│   ├── store_model.py     # Store model
│   ├── product_model.py   # Product model
│   ├── webhook_models.py  # Order & Inventory models
│   ├── automation_models.py  # Automation rules & run history
│   └── notification_models.py # Store notifications
├── integrations/
│   └── shopify.py         # Shopify Admin API client
├── routers/
│   ├── users.py           # Auth endpoints
│   ├── shopify.py         # OAuth & sync
│   ├── products.py        # Product CRUD
│   ├── ai.py              # AI features
│   ├── webhooks.py        # Webhook receiver
│   ├── store_data.py      # Orders, inventory & store settings
│   ├── actions.py         # Shopify write actions
│   ├── bulk_import.py     # CSV product import
│   ├── analytics.py       # Revenue analytics
│   ├── automation.py      # Automation rule CRUD & run
│   ├── notifications.py   # Notifications & delivery
│   └── health.py          # Health checks
├── worker/
│   ├── celery_app.py      # Celery app + beat schedule
│   └── tasks.py           # Background tasks
├── schemas/               # Pydantic request/response models
└── services/              # Business logic
    ├── user_service.py
    ├── store_service.py
    ├── product_service.py
    ├── shopify_service.py
    ├── ai_service.py
    ├── webhook_service.py
    ├── automation_service.py
    └── notification_service.py
```

## Setup

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in DATABASE_URL, SECRET_KEY, SHOPIFY_*, OPENAI_API_KEY

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

## Background Workers (Celery + Redis)

Periodic automation and delivery are run by Celery workers with Redis as the broker:

```bash
# Start a worker
celery -A app.worker.celery_app worker --loglevel=info

# Start the beat scheduler (for periodic jobs)
celery -A app.worker.celery_app beat --loglevel=info
```

Scheduled tasks:

| Task | Schedule |
| --- | --- |
| Sync products from Shopify | every 6h |
| Auto-fulfill paid orders | every 5 min |
| AI repricing | every 6h |
| Low-stock alerts | every 15 min |
| Deliver pending notifications | every minute |

Rules can also be triggered on-demand via `POST /automation/rules/{id}/run`. All of this is wired into `docker-compose.yml` (`redis`, `worker`, `beat` services); to opt out of Redis, leave the broker unset and rely on manual "Run now".

## Automation Rules

Rules automate store operations per store. Available rule types:

- **auto_fulfill** - fulfills paid, unfulfilled Shopify orders (`config.notify_customer`)
- **repricing** - recalculates product prices as cost × (1 + `margin_pct / 100`) and writes them to Shopify; opt into AI suggestions with `use_ai`
- **low_stock** - creates low-stock alerts when `available <= threshold`

Rule executions are recorded in `automation_runs` and surfaced with `GET /automation/runs`.

## Notifications

Events (new orders, order fulfillments, low stock) create rows in `notifications`. Delivery uses a webhook URL and/or SMTP email configured on the store (`PUT /store/settings`). `POST /notifications/deliver` triggers delivery immediately; the beat scheduler delivers periodically.

## Running Tests

```bash
python -m pytest tests/ -v
```

The test suite uses SQLite in-memory so no database is required.

## Database Migrations

```bash
# Generate migration after changing models
alembic revision --autogenerate -m "description"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Webhook Flow

1. User connects Shopify store via `/shopify/connect` (OAuth redirect)
2. `/shopify/callback` exchanges the code for an access token and saves the store
3. Webhooks are automatically registered for orders, products, and inventory
4. Shopify POSTs events to `/webhooks/shopify` (HMAC-verified)
5. Events are stored in `orders` and `inventory_levels` tables
6. Data is viewable via `/store/*` endpoints or the frontend

## Rate Limiting

- 60 requests per minute per IP (via slowapi)
- Rate limit exceeded returns HTTP 429

## Security

- All routes except public ones require `Authorization: Bearer <jwt-token>`
- Passwords hashed with bcrypt
- Webhook requests verified with HMAC-SHA256 signature
- Security headers added by middleware
- `OPENAI_API_KEY` optional - AI endpoints return 503 if not configured

## Health Checks

- `GET /health/` - service status
- `GET /health/db` - database connectivity
- `GET /health/stats` - record counts