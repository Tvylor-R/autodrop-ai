"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import StoreSwitcher from "@/components/StoreSwitcher";
import {
  getProducts,
  testStore,
  getNotifications,
  getNotificationUnreadCount,
  getAutomationRuns,
} from "@/lib/api";
import type { AutomationRun, NotificationItem } from "@/lib/api";

export default function DashboardPage() {
  const { token, shop, setShop } = useAuth();
  const router = useRouter();
  const [shopInput, setShopInput] = useState("");
  const [productCount, setProductCount] = useState<number | null>(null);
  const [storeStatus, setStoreStatus] = useState<string>("unknown");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
  }, [token, router]);

  useEffect(() => {
    if (!token || !shop) return;

    testStore(shop)
      .then((data) => {
        const d = data as { has_token: boolean };
        setStoreStatus(d.has_token ? "connected" : "no token");
      })
      .catch(() => setStoreStatus("not found"));

    getProducts(token, shop)
      .then((data: unknown) => {
        const products = data as { id: number }[];
        setProductCount(products.length);
      })
      .catch(() => setProductCount(0));

    getNotificationUnreadCount(token, shop)
      .then((data) => setUnreadCount(data.count))
      .catch(() => setUnreadCount(0));

    getNotifications(token, shop)
      .then((data) => setNotifications(data.slice(0, 5)))
      .catch(() => setNotifications([]));

    getAutomationRuns(token, shop)
      .then((data) => setRuns(data.slice(0, 5)))
      .catch(() => setRuns([]));
  }, [token, shop]);

  const handleConnect = () => {
    if (shopInput.trim()) {
      setShop(shopInput.trim());
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Auto<span className="text-blue-500">Drop</span> AI
        </h1>
        <div className="flex items-center gap-4">
          <StoreSwitcher />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-8 space-y-8">
        <h2 className="text-2xl font-semibold">Dashboard</h2>

        {!shop && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium">Connect Your Store</h3>
            <p className="text-gray-400 text-sm">
              Enter your Shopify store domain to get started.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="your-store.myshopify.com"
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleConnect}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {shop && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm">Store</p>
              <p className="text-xl font-semibold mt-1">{shop}</p>
              <span
                className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                  storeStatus === "connected"
                    ? "bg-green-900/50 text-green-400"
                    : "bg-yellow-900/50 text-yellow-400"
                }`}
              >
                {storeStatus}
              </span>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm">Products</p>
              <p className="text-3xl font-bold mt-1">
                {productCount !== null ? productCount : "--"}
              </p>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <p className="text-gray-400 text-sm">Actions</p>
              <div className="mt-3 space-y-2">
                <Link
                  href="/dashboard/connect"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Reconnect Store
                </Link>
                <Link
                  href="/dashboard/products"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Manage Products
                </Link>
                <Link
                  href="/dashboard/import"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Bulk Import
                </Link>
                <Link
                  href="/dashboard/orders"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Orders
                </Link>
                <Link
                  href="/dashboard/inventory"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Inventory
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Analytics
                </Link>
                <Link
                  href="/dashboard/ai"
                  className="block text-purple-400 hover:underline text-sm"
                >
                  AI Tools
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="block text-blue-400 hover:underline text-sm"
                >
                  Settings
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Alerts &amp; Notifications</h3>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    unreadCount > 0
                      ? "bg-blue-900/50 text-blue-400"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {unreadCount} unread
                </span>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500">No notifications yet.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span
                        className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                          n.is_read ? "bg-gray-700" : "bg-blue-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-gray-200 truncate">
                          {n.title || n.type || "Notification"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/dashboard/settings"
                className="block text-blue-400 hover:underline text-sm pt-2"
              >
                Manage in Settings
              </Link>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-3">
              <h3 className="text-lg font-medium">Recent Automation Runs</h3>
              {runs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No automation runs yet. Create a rule in Settings.
                </p>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-gray-200 truncate">
                          Rule #{run.rule_id} &mdash; {run.summary || run.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(run.ran_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded shrink-0 ${
                          run.status === "success"
                            ? "bg-green-900/50 text-green-400"
                            : run.status === "error"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/dashboard/settings"
                className="block text-blue-400 hover:underline text-sm pt-2"
              >
Manage Automation
            </Link>
            </div>
          </div>
          </>
        )}
      </main>
    </div>
  );
}
