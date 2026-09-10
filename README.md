# AutoDrop AI

AI-powered Shopify dropshipping automation platform. Connect your Shopify store, sync products, track orders and inventory in real-time via webhooks, and use AI to generate product descriptions, optimize pricing, and analyze trends.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, SQLAlchemy, PostgreSQL |
| **Frontend** | Next.js 16, React 19, Tailwind CSS |
| **Auth** | JWT (python-jose) + bcrypt |
| **AI** | OpenAI (`gpt-4o-mini`) |
| **Shopify** | Admin API + Webhooks (OAuth) |
| **Migrations** | Alembic |
| **DevOps** | Docker, Docker Compose |
| **Tests** | pytest (30 tests) |

## Features

- **User Authentication** - Register, login, JWT-based protected routes
- **Shopify Integration** - OAuth connect, product sync, live order/inventory fetch
- **Webhooks** - Real-time order, inventory, and product updates (HMAC verified)
- **AI Tools**:
  - Product description generator (SEO title + meta description)
  - Pricing optimizer with markup strategy
  - Trend analyzer (score, demand, competition, marketing angles)
- **Analytics** - Revenue trends, orders per day, best-selling products
- **Inventory Management** - Low-stock alerts, live stock levels
- **Order Tracking** - Payment and fulfillment status tracking

## Project Structure

```
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── core/            # Config, security, dependencies, middleware
│   │   ├── database/        # SQLAlchemy models & session
│   │   ├── integrations/    # Shopify API client
│   │   ├── routers/         # API endpoints
│   │   ├── schemas/         # Pydantic models
│   │   └── services/        # Business logic
│   ├── migrations/          # Alembic migrations
│   └── tests/               # pytest suite
├── frontend/                # Next.js frontend
│   └── src/
│       ├── app/             # Pages (App Router)
│       └── lib/             # API client, auth context
└── docker-compose.yml       # Full-stack container setup
```

## Quick Start

### Option 1: Docker (easiest)

```bash
# 1. Create backend/.env from example
cp backend/.env.example backend/.env
# Then fill in your real values (Shopify + OpenAI keys)

# 2. Build and run everything
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

### Option 2: Local Development

#### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL running locally

#### Backend

```bash
cd backend

# 1. Set up environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# 2. Configure credentials
cp .env.example .env
# Edit .env with your values:
#   DATABASE_URL, SECRET_KEY, SHOPIFY_CLIENT_ID/SECRET, OPENAI_API_KEY

# 3. Run migrations
alembic upgrade head

# 4. Start the server
uvicorn app.main:app --reload
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret (generate a random one) |
| `ALGORITHM` | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry (default: `30`) |
| `SHOPIFY_CLIENT_ID` | From your Shopify app |
| `SHOPIFY_CLIENT_SECRET` | From your Shopify app |
| `SHOPIFY_REDIRECT_URI` | OAuth callback URL |
| `OPENAI_API_KEY` | For AI features |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: `http://localhost:8000`) |

## API Overview

All routes except `/users/register`, `/users/login`, `/shopify/connect`, `/shopify/callback`, `/webhooks/shopify`, and `/health/*` require a Bearer token.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/users/register` | Create account & get token |
| `POST` | `/users/login` | Get JWT token |
| `GET` | `/shopify/connect?shop=` | Start Shopify OAuth |
| `GET` | `/shopify/callback` | OAuth callback (auto-registers webhooks) |
| `GET` | `/shopify/sync?shop=` | Sync products from Shopify |
| `GET` | `/shopify/test?shop=` | Check store connection status |
| `GET/POST` | `/products/?shop=` | List / create products |
| `GET/PUT/DELETE` | `/products/{id}` | Read / update / delete product |
| `POST` | `/ai/describe` | Generate product description |
| `POST` | `/ai/price` | Optimize pricing |
| `POST` | `/ai/trends` | Analyze product trend potential |
| `POST` | `/webhooks/shopify` | Shopify webhook receiver |
| `GET` | `/store/orders` | Orders from webhooks |
| `GET` | `/store/orders/live` | Orders from Shopify API |
| `GET` | `/store/inventory` | Inventory from webhooks |
| `GET` | `/store/inventory/live` | Inventory from Shopify API |
| `GET` | `/store/inventory/alerts` | Low stock alerts |
| `POST` | `/store/webhooks/register` | Re-register store webhooks |
| `GET` | `/analytics/summary` | Revenue & order summary |
| `GET` | `/analytics/revenue` | Daily revenue |
| `GET` | `/analytics/orders/trend` | Orders per day |
| `GET` | `/analytics/best-products` | Top selling products |
| `GET` | `/health/` `/health/db` `/health/stats` | Health checks |

## Tests

```bash
cd backend
python -m pytest tests/ -v
```

## Database Migrations

```bash
cd backend

# Generate a new migration after model changes
alembic revision --autogenerate -m "describe changes"

# Apply pending migrations
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

## Setting Up Shopify

1. Create a Shopify app at https://partners.shopify.com
2. Add the app's Client ID and Client Secret to `backend/.env`
3. Configure the redirect URI to `http://localhost:8000/shopify/callback`
4. Required scopes: `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_orders`

## Setting Up OpenAI

1. Get an API key from https://platform.openai.com
2. Add it as `OPENAI_API_KEY` in `backend/.env`
3. AI endpoints return a clear error if the key is missing

## Development Notes

- Backend runs with `--reload` for hot reloading
- Frontend runs Next.js dev server with Turbopack
- CORS is configured to allow frontend at `http://localhost:3000`
- API has rate limiting (60 req/min), request logging, and security headers