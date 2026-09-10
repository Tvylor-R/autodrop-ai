"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getOrders, getOrdersLive, fulfillOrder, cancelOrder } from "@/lib/api";

interface Order {
  id: number;
  shopify_order_id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  total_price: number;
  currency: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  line_items: { title: string; quantity: number; price: string }[] | null;
  created_at_shopify: string | null;
  received_at: string;
}

export default function OrdersPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"local" | "live">("live");
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const getShopifyId = (order: Order): number => {
    const raw = order.shopify_order_id || String(order.id);
    const parsed = parseInt(String(raw), 10);
    return Number.isNaN(parsed) ? order.id : parsed;
  };

  const loadOrders = useCallback(async () => {
    if (!token || !shop) return;
    setError("");
    try {
      if (mode === "live") {
        const data = await getOrdersLive(token, shop);
        setOrders(data as Order[]);
      } else {
        const data = await getOrders(token, shop);
        setOrders(data as Order[]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [token, shop, mode]);

  const handleFulfill = async (order: Order) => {
    const trackingNumber = window.prompt(
      `Enter tracking number for order #${order.order_number || order.shopify_order_id}:`,
      ""
    );
    if (trackingNumber === null) return;

    setActionError("");
    setActionId(order.id);
    try {
      await fulfillOrder(token!, shop!, {
        order_id: getShopifyId(order),
        tracking_number: trackingNumber.trim(),
        notify_customer: true,
      });
      await loadOrders();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to fulfill order"
      );
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (order: Order) => {
    if (!window.confirm(`Cancel order #${order.order_number || order.shopify_order_id}?`)) {
      return;
    }

    setActionError("");
    setActionId(order.id);
    try {
      await cancelOrder(token!, shop!, { order_id: getShopifyId(order) });
      await loadOrders();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to cancel order"
      );
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/param change
    loadOrders();
  }, [token, router, mode, loadOrders]);

  const getStatusBadge = (status: string | null) => {
    const colors: Record<string, string> = {
      paid: "bg-green-900/50 text-green-400",
      pending: "bg-yellow-900/50 text-yellow-400",
      refunded: "bg-red-900/50 text-red-400",
      partially_paid: "bg-blue-900/50 text-blue-400",
      fulfilled: "bg-green-900/50 text-green-400",
      unfulfilled: "bg-yellow-900/50 text-yellow-400",
      partial: "bg-blue-900/50 text-blue-400",
    };
    return colors[status || ""] || "bg-gray-800 text-gray-400";
  };

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
            onClick={() => router.push("/dashboard/ai")}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            AI Tools
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
          <h2 className="text-2xl font-semibold">Orders</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("local")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === "local"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              From Webhooks
            </button>
            <button
              onClick={() => setMode("live")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === "live"
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Live from Shopify
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {actionError && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">No orders yet</p>
            <p className="text-sm">
              {mode === "local"
                ? "Orders will appear here as Shopify sends webhook events."
                : "No orders found directly from Shopify."}
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="px-6 py-3">Order</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3">Fulfillment</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-4 font-medium">
                      #{order.order_number || order.shopify_order_id}
                    </td>
                    <td className="px-6 py-4">
                      <div>{order.customer_name || "Guest"}</div>
                      <div className="text-xs text-gray-500">
                        {order.customer_email || "--"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {order.line_items
                        ? order.line_items.reduce(
                            (sum, i) => sum + (i.quantity || 0),
                            0
                          )
                        : "--"}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {order.total_price.toFixed(2)}{" "}
                      <span className="text-gray-500 text-xs">
                        {order.currency || "USD"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded ${getStatusBadge(
                          order.financial_status
                        )}`}
                      >
                        {order.financial_status || "unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded ${getStatusBadge(
                          order.fulfillment_status
                        )}`}
                      >
                        {order.fulfillment_status || "unfulfilled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {order.created_at_shopify
                        ? new Date(order.created_at_shopify).toLocaleDateString()
                        : new Date(order.received_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleFulfill(order)}
                          disabled={actionId === order.id}
                          className="text-blue-400 hover:text-blue-300 text-sm transition disabled:opacity-50"
                        >
                          {actionId === order.id ? "..." : "Fulfill"}
                        </button>
                        <button
                          onClick={() => handleCancel(order)}
                          disabled={actionId === order.id}
                          className="text-red-400 hover:text-red-300 text-sm transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
