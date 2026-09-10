"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { aiDescribe, aiPrice, aiTrends } from "@/lib/api";

type Tab = "describe" | "price" | "trends";

interface DescriptionResult {
  description: string;
  seo_title: string;
  seo_description: string;
}

interface PricingResult {
  suggested_price: number;
  markup_percentage: number;
  pricing_strategy: string;
  reasoning: string;
}

interface TrendResult {
  trend_score: number;
  demand_level: string;
  competition_level: string;
  recommendation: string;
  target_audience: string;
  marketing_angles: string[];
}

export default function AIPage() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("describe");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [vendor, setVendor] = useState("");
  const [productType, setProductType] = useState("");
  const [tags, setTags] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");

  const [descResult, setDescResult] = useState<DescriptionResult | null>(null);
  const [priceResult, setPriceResult] = useState<PricingResult | null>(null);
  const [trendResult, setTrendResult] = useState<TrendResult | null>(null);

  const handleDescribe = async () => {
    if (!token || !title.trim()) return;
    setLoading(true);
    setError("");
    setDescResult(null);
    try {
      const data = await aiDescribe(token, {
        title: title.trim(),
        vendor: vendor.trim() || undefined,
        product_type: productType.trim() || undefined,
        tags: tags.trim() || undefined,
      });
      setDescResult(data as DescriptionResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePrice = async () => {
    if (!token || !title.trim()) return;
    setLoading(true);
    setError("");
    setPriceResult(null);
    try {
      const data = await aiPrice(token, {
        title: title.trim(),
        cost_price: costPrice ? parseFloat(costPrice) : undefined,
        competitor_price: competitorPrice
          ? parseFloat(competitorPrice)
          : undefined,
        product_type: productType.trim() || undefined,
      });
      setPriceResult(data as PricingResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTrends = async () => {
    if (!token || !title.trim()) return;
    setLoading(true);
    setError("");
    setTrendResult(null);
    try {
      const data = await aiTrends(token, {
        title: title.trim(),
        vendor: vendor.trim() || undefined,
        product_type: productType.trim() || undefined,
      });
      setTrendResult(data as TrendResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "describe", label: "Description Generator" },
    { key: "price", label: "Pricing Optimizer" },
    { key: "trends", label: "Trend Analyzer" },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      very_high: "bg-green-900/50 text-green-400",
      high: "bg-green-900/50 text-green-400",
      medium: "bg-yellow-900/50 text-yellow-400",
      low: "bg-red-900/50 text-red-400",
      saturated: "bg-red-900/50 text-red-400",
    };
    return colors[level] || "bg-gray-800 text-gray-400";
  };

  if (!token) return null;

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

      <main className="max-w-5xl mx-auto p-8 space-y-6">
        <h2 className="text-2xl font-semibold">AI Tools</h2>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-800 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setError("");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Input Form */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Product Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Vendor / Brand"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Product Type (e.g. electronics, fashion)"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            {activeTab === "describe" && (
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            )}
            {activeTab === "price" && (
              <>
                <input
                  type="number"
                  placeholder="Cost Price ($)"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  step="0.01"
                  className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  placeholder="Competitor Price ($)"
                  value={competitorPrice}
                  onChange={(e) => setCompetitorPrice(e.target.value)}
                  step="0.01"
                  className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </>
            )}
          </div>
          <button
            onClick={
              activeTab === "describe"
                ? handleDescribe
                : activeTab === "price"
                ? handlePrice
                : handleTrends
            }
            disabled={loading || !title.trim()}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium transition"
          >
            {loading ? "Analyzing..." : `Generate ${activeTab === "describe" ? "Description" : activeTab === "price" ? "Pricing" : "Trend Analysis"}`}
          </button>
        </div>

        {/* Results */}
        {descResult && activeTab === "describe" && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-3 text-purple-400">
                Product Description
              </h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {descResult.description}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  SEO Title
                </h3>
                <p className="text-white">{descResult.seo_title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {descResult.seo_title.length}/60 characters
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Meta Description
                </h3>
                <p className="text-white">{descResult.seo_description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {descResult.seo_description.length}/160 characters
                </p>
              </div>
            </div>
          </div>
        )}

        {priceResult && activeTab === "price" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Suggested Price</p>
                <p className="text-3xl font-bold text-green-400 mt-1">
                  ${priceResult.suggested_price.toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Markup</p>
                <p className="text-3xl font-bold text-blue-400 mt-1">
                  {priceResult.markup_percentage.toFixed(0)}%
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Strategy</p>
                <p className="text-lg font-medium mt-1">
                  {priceResult.pricing_strategy}
                </p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Reasoning
              </h3>
              <p className="text-gray-300">{priceResult.reasoning}</p>
            </div>
          </div>
        )}

        {trendResult && activeTab === "trends" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Trend Score</p>
                <p
                  className={`text-4xl font-bold mt-1 ${getScoreColor(
                    trendResult.trend_score
                  )}`}
                >
                  {trendResult.trend_score}
                </p>
                <p className="text-xs text-gray-500">/100</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Demand</p>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-sm rounded ${getLevelBadge(
                    trendResult.demand_level
                  )}`}
                >
                  {trendResult.demand_level}
                </span>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Competition</p>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-sm rounded ${getLevelBadge(
                    trendResult.competition_level
                  )}`}
                >
                  {trendResult.competition_level}
                </span>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <p className="text-sm text-gray-400">Target Audience</p>
                <p className="text-sm mt-2">{trendResult.target_audience}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Recommendation
              </h3>
              <p className="text-gray-300">{trendResult.recommendation}</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Marketing Angles
              </h3>
              <div className="space-y-2">
                {trendResult.marketing_angles.map((angle, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-gray-300"
                  >
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{angle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
