"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getAnalyticsSummary,
  getAnalyticsRevenue,
  getAnalyticsOrders,
  getBestProducts,
  getProducts,
  getAutomationRules,
  runAutomationRule,
} from "@/lib/api";
import type { AutomationRule } from "@/lib/api";

interface Summary {
  period_days: number;
  total_revenue: number;
  order_count: number;
  avg_order_value: number;
  items_sold: number;
  pending_orders: number;
}

interface BestProduct {
  title: string;
  quantity: number;
  revenue: number;
}

interface Product {
  id: number;
  title: string;
  cost: number | null;
  shopify_variant_id: string | null;
}

export default function AnalyticsPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<Record<string, number>>({});
  const [orderTrend, setOrderTrend] = useState<Record<string, number>>({});
  const [bestProducts, setBestProducts] = useState<BestProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [multiplier, setMultiplier] = useState(2.5);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    if (!token || !shop) return;
    setError("");
    setRunMessage("");
    try {
      const [s, r, o, b, p] = await Promise.all([
        getAnalyticsSummary(token, shop, days),
        getAnalyticsRevenue(token, shop, days),
        getAnalyticsOrders(token, shop, days),
        getBestProducts(token, shop, days),
        getProducts(token, shop),
      ]);
      setSummary(s as Summary);
      setRevenue((r as { daily_revenue: Record<string, number> }).daily_revenue);
      setOrderTrend(
        (o as { daily_orders: Record<string, number> }).daily_orders
      );
      setBestProducts((b as { best_products: BestProduct[] }).best_products);
      setProducts(p as Product[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token, shop, days]);

  const handleRunRepricing = async () => {
    if (!token || !shop) return;
    setRunning(true);
    setError("");
    setRunMessage("");
    try {
      const rules = (await getAutomationRules(token, shop)) as AutomationRule[];
      const repricing = rules.find((r) => r.rule_type === "repricing");
      if (!repricing) {
        setRunMessage(
          "No repricing rule configured. Add one in Settings > Automation."
        );
        return;
      }
      const res = (await runAutomationRule(token, shop, repricing.id)) as {
        status?: string;
        summary?: string;
      };
      setRunMessage(
        res.summary || `Repricing rule finished (${res.status ?? "done"}).`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run repricing");
    } finally {
      setRunning(false);
    }
  };

  const avgPriceByTitle = new Map<string, number>();
  bestProducts.forEach((bp) => {
    avgPriceByTitle.set(bp.title.toLowerCase(), bp.revenue / bp.quantity);
  });

  const pricingRows = products
    .filter((p) => p.cost != null && p.cost > 0)
    .map((p) => {
      const avg = avgPriceByTitle.get(p.title.toLowerCase()) ?? null;
      const cost = p.cost as number;
      const suggested = cost * multiplier;
      const marginAtAvg =
        avg && avg > 0 ? ((avg - cost) / avg) * 100 : null;
      return { product: p, mid: avg, suggested, marginAtAvg };
    })
    .sort((a, b) => b.suggested - a.suggested)
    .slice(0, 12);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/day-change
    loadAnalytics();
  }, [token, router, days, loadAnalytics]);

  const maxRevenue = Math.max(...Object.values(revenue), 1);
  const maxOrders = Math.max(...Object.values(orderTrend), 1);

  const dates = Array.from(
    new Set([
      ...Object.keys(revenue),
      ...Object.keys(orderTrend),
    ])
  ).sort();

  if (!token || !shop) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Auto<span className="text-blue-500">Drop</span> AI
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/dashboard/products")}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Products
          </button>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Analytics</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  days === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : summary ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                <p className="text-sm text-gray-400">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  ${summary.total_revenue.toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                <p className="text-sm text-gray-400">Orders</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.order_count}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                <p className="text-sm text-gray-400">Avg Order Value</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  ${summary.avg_order_value.toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                <p className="text-sm text-gray-400">Items Sold</p>
                <p className="text-2xl font-bold mt-1">{summary.items_sold}</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                <p className="text-sm text-gray-400">Pending Orders</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">
                  {summary.pending_orders}
                </p>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Revenue Trend</h3>
              <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: "120px" }}>
                {dates.length === 0 && (
                  <p className="text-gray-500 text-sm">No revenue data</p>
                )}
                {dates.map((date) => (
                  <div
                    key={date}
                    className="flex flex-col items-center min-w-[24px]"
                    title={`${date}: $${(revenue[date] || 0).toFixed(2)}`}
                  >
                    <div
                      className="bg-green-500 rounded-t w-full"
                      style={{
                        height: Math.max(
                          4,
                          ((revenue[date] || 0) / maxRevenue) * 100
                        ),
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1 overflow-x-auto text-xs text-gray-500">
                {dates.map((date) => (
                  <div key={date} className="min-w-[24px] text-center">
                    {date.slice(5)}
                  </div>
                ))}
              </div>
            </div>

            {/* Orders Trend */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Orders per Day</h3>
              <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: "100px" }}>
                {dates.length === 0 && (
                  <p className="text-gray-500 text-sm">No order data</p>
                )}
                {dates.map((date) => (
                  <div
                    key={date}
                    className="flex flex-col items-center min-w-[24px]"
                    title={`${date}: ${(orderTrend[date] || 0)} orders`}
                  >
                    <div
                      className="bg-blue-500 rounded-t w-full"
                      style={{
                        height: Math.max(
                          4,
                          ((orderTrend[date] || 0) / maxOrders) * 100
                        ),
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1 overflow-x-auto text-xs text-gray-500">
                {dates.map((date) => (
                  <div key={date} className="min-w-[24px] text-center">
                    {date.slice(5)}
                  </div>
                ))}
              </div>
            </div>

            {/* Best Products */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Best Products</h3>
              {bestProducts.length === 0 ? (
                <p className="text-gray-500 text-sm">No product sales data</p>
              ) : (
                <div className="space-y-3">
                  {bestProducts.map((product, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-gray-800"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-gray-500 text-sm w-6">
                          #{i + 1}
                        </span>
                        <span className="text-white truncate">
                          {product.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <span className="text-gray-400">
                          {product.quantity} sold
                        </span>
                        <span className="text-green-400 font-medium">
                          ${product.revenue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing & Margin */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-lg font-medium">
                  Pricing &amp; Margin Suggestions
                </h3>
                <div className="flex gap-2">
                  {[2, 2.5, 3, 5].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(m)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        multiplier === m
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm text-gray-400">
                Suggested retail = product cost &times; margin. Set costs on the
                Products page, then apply with the repricing rule.
              </p>

              {runMessage && (
                <div className="bg-blue-900/30 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg text-sm">
                  {runMessage}
                </div>
              )}

              {pricingRows.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No products with a cost set. Open Products &gt; Edit to add
                  costs, or import via the CSV template.
                </p>
              ) : (
                <div className="space-y-3">
                  {pricingRows.map(({ product, mid, suggested, marginAtAvg }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between py-2 border-b border-gray-800 flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-white truncate">
                          {product.title}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                          cost ${(product.cost as number).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        {mid != null ? (
                          <span className="text-gray-400">
                            avg ${mid.toFixed(2)}{" "}
                            <span
                              className={
                                marginAtAvg != null && marginAtAvg > 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              ({marginAtAvg?.toFixed(0)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-600">no sales yet</span>
                        )}
                        <span className="text-blue-300 font-medium">
                          ${suggested.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={handleRunRepricing}
                  disabled={running}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                >
                  {running ? "Running..." : "Run Repricing Now"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}