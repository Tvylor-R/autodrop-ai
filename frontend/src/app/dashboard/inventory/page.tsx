"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getInventory,
  getInventoryLive,
  getLowStockAlerts,
  getLocations,
  updateInventoryLevel,
} from "@/lib/api";

interface InventoryItem {
  id: number;
  shopify_inventory_item_id: string;
  product_title: string | null;
  sku: string | null;
  available: number;
  incoming: number;
  inventory_item_id?: number;
  location_id?: number;
}

interface AlertItem {
  product_title: string;
  sku: string;
  available: number;
}

export default function InventoryPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"local" | "live">("live");
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async () => {
    if (!token || !shop) return;
    setError("");
    try {
      if (mode === "live") {
        const data = await getInventoryLive(token, shop);
        setItems(data as InventoryItem[]);
      } else {
        const data = await getInventory(token, shop);
        setItems(data as InventoryItem[]);

        const alertData = await getLowStockAlerts(token, shop, 5);
        setAlerts((alertData as { items: AlertItem[] }).items || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [token, shop, mode]);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/param change
    loadData();
  }, [token, router, mode, loadData]);

  const getStockBadge = (available: number) => {
    if (available === 0) return "bg-red-900/50 text-red-400";
    if (available <= 5) return "bg-yellow-900/50 text-yellow-400";
    return "bg-green-900/50 text-green-400";
  };

  const handleUpdateStock = async (item: InventoryItem) => {
    if (!token || !shop) return;

    const inventoryItemId =
      item.inventory_item_id ?? parseInt(String(item.shopify_inventory_item_id), 10);
    if (!inventoryItemId) {
      setActionError("No Shopify inventory item ID available");
      return;
    }

    const quantity = window.prompt(
      `Update stock for "${item.product_title || "Item"}" (current: ${item.available}):`,
      String(item.available)
    );
    if (quantity === null) return;

    setActionError("");
    setActionId(String(item.id));
    try {
      const locations = (await getLocations(token, shop)) as { id: number }[];
      const locationId =
        item.location_id ?? (locations.length > 0 ? locations[0].id : undefined);
      if (!locationId) {
        setActionError("No inventory location found for this store");
        setActionId(null);
        return;
      }

      await updateInventoryLevel(token, shop, {
        location_id: Number(locationId),
        inventory_item_id: inventoryItemId,
        available: parseInt(quantity, 10) || 0,
      });
      await loadData();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update stock"
      );
    } finally {
      setActionId(null);
    }
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
          <h2 className="text-2xl font-semibold">Inventory</h2>
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

        {alerts.length > 0 && mode === "local" && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <h3 className="text-yellow-400 font-medium mb-2">
              Low Stock Alert ({alerts.length} items)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {alerts.map((item, i) => (
                <div
                  key={i}
                  className="bg-gray-900/50 rounded px-3 py-2 text-sm"
                >
                  <span className="text-white">{item.product_title}</span>
                  <span className="text-red-400 ml-2">
                    ({item.available} left)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">No inventory data</p>
            <p className="text-sm">
              {mode === "local"
                ? "Inventory updates will appear here from Shopify webhook events."
                : "No inventory data found directly from Shopify."}
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3">Available</th>
                  <th className="px-6 py-3">Incoming</th>
                  <th className="px-6 py-3">Status</th>
                  {mode === "live" && (
                    <th className="px-6 py-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-4">
                      {item.product_title || "Unknown"}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {item.sku || "--"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded font-medium ${getStockBadge(
                          item.available
                        )}`}
                      >
                        {item.available}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {item.incoming || 0}
                    </td>
                    <td className="px-6 py-4">
                      {item.available === 0 ? (
                        <span className="text-red-400 text-sm">Out of Stock</span>
                      ) : item.available <= 5 ? (
                        <span className="text-yellow-400 text-sm">Low Stock</span>
                      ) : (
                        <span className="text-green-400 text-sm">In Stock</span>
                      )}
                    </td>
                    {mode === "live" && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUpdateStock(item)}
                          disabled={actionId === String(item.id)}
                          className="text-blue-400 hover:text-blue-300 text-sm transition disabled:opacity-50"
                        >
                          {actionId === String(item.id) ? "..." : "Update Stock"}
                        </button>
                      </td>
                    )}
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
