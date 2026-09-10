"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ConnectPage() {
  const { setShop } = useAuth();
  const router = useRouter();
  const [shopInput, setShopInput] = useState("");
  const [error, setError] = useState("");

  const handleConnect = () => {
    const domain = shopInput.trim();
    if (!domain) {
      setError("Please enter a store domain");
      return;
    }
    setError("");
    setShop(domain);
    router.push("/dashboard");
  };

  const handleShopifyOAuth = () => {
    const domain = shopInput.trim();
    if (!domain) {
      setError("Please enter a store domain first");
      return;
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    // Navigating to the backend API host (not an internal Next.js route);
    // the backend performs the OAuth redirect to Shopify.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${apiUrl}/shopify/connect?shop=${encodeURIComponent(domain)}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Auto<span className="text-blue-500">Drop</span> AI
        </h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          Back to Dashboard
        </button>
      </nav>

      <main className="max-w-lg mx-auto p-8 space-y-6">
        <h2 className="text-2xl font-semibold">Connect Shopify Store</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            placeholder="your-store.myshopify.com"
            value={shopInput}
            onChange={(e) => setShopInput(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />

          <div className="flex gap-3">
            <button
              onClick={handleConnect}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition"
            >
              Save Domain
            </button>
            <button
              onClick={handleShopifyOAuth}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition"
            >
              Connect via Shopify
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-400 space-y-2">
          <p>
            <strong className="text-white">Save Domain</strong> - Just saves
            the domain for manual product management.
          </p>
          <p>
            <strong className="text-white">Connect via Shopify</strong> -
            Initiates OAuth to automatically sync products from your store.
          </p>
        </div>
      </main>
    </div>
  );
}
