const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, token }: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export async function login(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const res = await fetch(`${API_BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Login failed");
  }

  return res.json();
}

export async function register(
  fullName: string,
  email: string,
  password: string
) {
  return api("/users/register", {
    method: "POST",
    body: { full_name: fullName, email, password },
  });
}

export async function getUser(token: string) {
  return api("/users/me", { token });
}

export async function updateUser(
  token: string,
  data: { full_name?: string; email?: string }
) {
  return api("/users/me", { method: "PUT", body: data, token });
}

export async function changePassword(
  token: string,
  data: { current_password: string; new_password: string }
) {
  return api("/users/me/password", {
    method: "PUT",
    body: data,
    token,
  });
}

export async function getStoreInfo(token: string, shop: string) {
  return api(`/store/info?shop=${encodeURIComponent(shop)}`, { token });
}

export async function getProducts(token: string, shop: string) {
  return api(`/products/?shop=${encodeURIComponent(shop)}`, { token });
}

export async function createProduct(
  token: string,
  shop: string,
  data: {
    shopify_product_id: string;
    title: string;
    vendor?: string;
    status?: string;
    cost?: number;
    shopify_variant_id?: string;
  }
) {
  return api(`/products/?shop=${encodeURIComponent(shop)}`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateProduct(
  token: string,
  productId: number,
  data: {
    title?: string;
    vendor?: string;
    status?: string;
    cost?: number;
    shopify_variant_id?: string;
  }
) {
  return api(`/products/${productId}`, {
    method: "PUT",
    body: data,
    token,
  });
}

export async function deleteProduct(token: string, productId: number) {
  return api(`/products/${productId}`, {
    method: "DELETE",
    token,
  });
}

export async function syncProducts(token: string, shop: string) {
  return api(`/shopify/sync?shop=${encodeURIComponent(shop)}`, { token });
}

export async function testStore(shop: string) {
  return api(`/shopify/test?shop=${encodeURIComponent(shop)}`);
}

export async function aiDescribe(
  token: string,
  data: { title: string; vendor?: string; product_type?: string; tags?: string }
) {
  return api("/ai/describe", { method: "POST", body: data, token });
}

export async function aiPrice(
  token: string,
  data: {
    title: string;
    cost_price?: number;
    competitor_price?: number;
    product_type?: string;
  }
) {
  return api("/ai/price", { method: "POST", body: data, token });
}

export async function aiTrends(
  token: string,
  data: { title: string; vendor?: string; product_type?: string }
) {
  return api("/ai/trends", { method: "POST", body: data, token });
}

export async function getOrders(token: string, shop: string) {
  return api(`/store/orders?shop=${encodeURIComponent(shop)}`, { token });
}

export async function getOrdersLive(token: string, shop: string) {
  return api(
    `/store/orders/live?shop=${encodeURIComponent(shop)}`,
    { token }
  );
}

export async function getInventory(token: string, shop: string) {
  return api(`/store/inventory?shop=${encodeURIComponent(shop)}`, { token });
}

export async function getInventoryLive(token: string, shop: string) {
  return api(
    `/store/inventory/live?shop=${encodeURIComponent(shop)}`,
    { token }
  );
}

export async function getLowStockAlerts(
  token: string,
  shop: string,
  threshold: number = 5
) {
  return api(
    `/store/inventory/alerts?shop=${encodeURIComponent(shop)}&threshold=${threshold}`,
    { token }
  );
}

export async function getAnalyticsSummary(
  token: string,
  shop: string,
  days: number = 30
) {
  return api(
    `/analytics/summary?shop=${encodeURIComponent(shop)}&days=${days}`,
    { token }
  );
}

export async function getAnalyticsRevenue(
  token: string,
  shop: string,
  days: number = 30
) {
  return api(
    `/analytics/revenue?shop=${encodeURIComponent(shop)}&days=${days}`,
    { token }
  );
}

export async function getAnalyticsOrders(
  token: string,
  shop: string,
  days: number = 30
) {
  return api(
    `/analytics/orders/trend?shop=${encodeURIComponent(shop)}&days=${days}`,
    { token }
  );
}

export async function getBestProducts(
  token: string,
  shop: string,
  days: number = 30,
  limit: number = 10
) {
  return api(
    `/analytics/best-products?shop=${encodeURIComponent(shop)}&days=${days}&limit=${limit}`,
    { token }
  );
}

export async function getLocations(token: string, shop: string) {
  return api(`/actions/locations?shop=${encodeURIComponent(shop)}`, { token });
}

export async function createShopifyProduct(
  token: string,
  shop: string,
  data: {
    title: string;
    body_html?: string;
    vendor?: string;
    product_type?: string;
    tags?: string;
    price?: string;
    sku?: string;
    image_url?: string;
  }
) {
  return api(`/actions/products?shop=${encodeURIComponent(shop)}`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function fulfillOrder(
  token: string,
  shop: string,
  data: {
    order_id: number;
    tracking_company?: string;
    tracking_number?: string;
    tracking_url?: string;
    notify_customer?: boolean;
  }
) {
  return api(`/actions/orders/fulfill?shop=${encodeURIComponent(shop)}`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function cancelOrder(
  token: string,
  shop: string,
  data: { order_id: number; reason?: string }
) {
  return api(`/actions/orders/cancel?shop=${encodeURIComponent(shop)}`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateInventoryLevel(
  token: string,
  shop: string,
  data: {
    location_id: number;
    inventory_item_id: number;
    available: number;
  }
) {
  return api(`/actions/inventory/update?shop=${encodeURIComponent(shop)}`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function importProductsFromCsv(
  token: string,
  shop: string,
  file: File
) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(
    `${API_BASE}/import/products?shop=${encodeURIComponent(shop)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Import failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function downloadTemplate() {
  const res = await fetch(`${API_BASE}/import/template`);
  if (!res.ok) throw new Error("Failed to download template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export interface AutomationRule {
  id: number;
  store_id: number;
  name: string;
  rule_type: "auto_fulfill" | "repricing" | "low_stock";
  config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_count: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: number;
  rule_id: number;
  status: string;
  summary: string | null;
  error: string | null;
  ran_at: string;
}

export interface NotificationItem {
  id: number;
  store_id: number;
  type: string | null;
  severity: string | null;
  title: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export async function getStoreInfoExtended(token: string, shop: string) {
  return api(`/store/info?shop=${encodeURIComponent(shop)}`, { token });
}

export async function updateStoreSettings(
  token: string,
  shop: string,
  data: {
    notification_email?: string;
    notification_webhook_url?: string;
    low_stock_threshold?: number;
  }
) {
  return api(`/store/settings?shop=${encodeURIComponent(shop)}`, {
    method: "PUT",
    body: data,
    token,
  });
}

export async function getNotifications(
  token: string,
  shop: string,
  unreadOnly = false
) {
  return api<NotificationItem[]>(
    `/notifications?shop=${encodeURIComponent(shop)}&unread_only=${unreadOnly}`,
    { token }
  );
}

export async function getNotificationUnreadCount(token: string, shop: string) {
  return api<{ count: number }>(
    `/notifications/unread-count?shop=${encodeURIComponent(shop)}`,
    { token }
  );
}

export async function markNotificationRead(
  token: string,
  shop: string,
  notificationId: number
) {
  return api(
    `/notifications/${notificationId}/read?shop=${encodeURIComponent(shop)}`,
    { method: "POST", token }
  );
}

export async function deliverNotifications(token: string, shop: string) {
  return api(
    `/notifications/deliver?shop=${encodeURIComponent(shop)}`,
    { method: "POST", token }
  );
}

export async function getAutomationRules(token: string, shop: string) {
  return api<AutomationRule[]>(
    `/automation/rules?shop=${encodeURIComponent(shop)}`,
    { token }
  );
}

export async function createAutomationRule(
  token: string,
  shop: string,
  data: {
    name: string;
    rule_type: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
  }
) {
  return api(`/automation/rules?shop=${encodeURIComponent(shop)}`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAutomationRule(
  token: string,
  shop: string,
  ruleId: number,
  data: { name?: string; config?: Record<string, unknown>; enabled?: boolean }
) {
  return api(`/automation/rules/${ruleId}?shop=${encodeURIComponent(shop)}`, {
    method: "PUT",
    body: data,
    token,
  });
}

export async function toggleAutomationRule(
  token: string,
  shop: string,
  ruleId: number
) {
  return api(
    `/automation/rules/${ruleId}/toggle?shop=${encodeURIComponent(shop)}`,
    { method: "POST", token }
  );
}

export async function runAutomationRule(
  token: string,
  shop: string,
  ruleId: number
) {
  return api(
    `/automation/rules/${ruleId}/run?shop=${encodeURIComponent(shop)}`,
    { method: "POST", token }
  );
}

export async function deleteAutomationRule(
  token: string,
  shop: string,
  ruleId: number
) {
  return api(`/automation/rules/${ruleId}?shop=${encodeURIComponent(shop)}`, {
    method: "DELETE",
    token,
  });
}

export async function getAutomationRuns(
  token: string,
  shop: string,
  ruleId?: number
) {
  const ruleParam = ruleId ? `&rule_id=${ruleId}` : "";
  return api<AutomationRun[]>(
    `/automation/runs?shop=${encodeURIComponent(shop)}${ruleParam}`,
    { token }
  );
}
