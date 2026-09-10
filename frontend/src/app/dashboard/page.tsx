"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getProducts, testStore } from "@/lib/api";

export default function DashboardPage() {
  const { token, shop, setShop, logout } = useAuth();
  const router = useRouter();
  const [shopInput, setShopInput] = useState("");
  const [productCount, setProductCount] = useState<number | null>(null);
  const [storeStatus, setStoreStatus] = useState<string>("unknown");

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
          {shop && (
            <span className="text-gray-400 text-sm">{shop}</span>
          )}
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Logout
          </button>
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
        )}
      </main>
    </div>
  );
}
