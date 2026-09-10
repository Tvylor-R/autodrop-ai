"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setShop } = useAuth();

  const shop = searchParams.get("shop") || "";
  const status = searchParams.get("status");

  useEffect(() => {
    if (shop && status === "success") {
      setShop(shop);
      const t = setTimeout(() => router.replace("/dashboard"), 2500);
      return () => clearTimeout(t);
    }
  }, [shop, status, setShop, router]);

  const connected = Boolean(shop) && status === "success";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8 text-center">
        {connected ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-green-600 flex items-center justify-center text-3xl">
              ✓
            </div>
            <h1 className="text-2xl font-bold">Store Connected</h1>
            <p className="text-gray-400 text-sm">
              <strong className="text-white">{shop}</strong> is connected via
              Shopify. Redirecting you to the dashboard...
            </p>
            <button
              onClick={() => router.replace("/dashboard")}
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
            >
              Continue to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-600 flex items-center justify-center text-3xl">
              ✕
            </div>
            <h1 className="text-2xl font-bold">Connection Incomplete</h1>
            <p className="text-gray-400 text-sm">
              We could not finish connecting your store. Please try again.
            </p>
            <Link
              href="/dashboard/connect"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
            >
              Back to Connect
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}