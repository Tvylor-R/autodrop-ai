"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token) router.push("/dashboard");
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold">
          Auto<span className="text-blue-500">Drop</span> AI
        </h1>
        <p className="text-gray-400 text-lg max-w-md">
          AI-powered Shopify dropshipping automation. Connect your store, sync
          products, and let AI handle the rest.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
