"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  syncProducts,
  aiDescribe,
  createShopifyProduct,
} from "@/lib/api";

interface Product {
  id: number;
  shopify_product_id: string;
  shopify_variant_id: string | null;
  title: string;
  vendor: string | null;
  status: string | null;
  cost: number | null;
  created_at: string;
}

export default function ProductsPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({
    shopify_product_id: "",
    title: "",
    vendor: "",
  });
  const [aiModal, setAiModal] = useState<Product | null>(null);
  const [aiResult, setAiResult] = useState<{
    description: string;
    seo_title: string;
    seo_description: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    vendor: "",
    status: "active",
    cost: "",
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(
    new Set()
  );

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.vendor || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSelect = (id: number) => {
    const next = new Set(selectedProducts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProducts(next);
  };

  const loadProducts = useCallback(async () => {
    if (!token || !shop) return;
    try {
      const data = await getProducts(token, shop);
      setProducts(data as Product[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [token, shop]);

  const handleBulkDelete = async () => {
    if (!token) return;
    if (!confirm(`Delete ${selectedProducts.size} products?`)) return;
    for (const id of selectedProducts) {
      await deleteProduct(token, id);
    }
    setSelectedProducts(new Set());
    await loadProducts();
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    loadProducts();
  }, [token, router, loadProducts]);

  const handleSync = async () => {
    if (!token || !shop) return;
    setSyncing(true);
    setError("");
    try {
      await syncProducts(token, shop);
      await loadProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !shop) return;
    setError("");
    try {
      await createProduct(token, shop, {
        shopify_product_id: newProduct.shopify_product_id,
        title: newProduct.title,
        vendor: newProduct.vendor || undefined,
      });
      setNewProduct({ shopify_product_id: "", title: "", vendor: "" });
      setShowAdd(false);
      await loadProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(token, id);
      await loadProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const handleOpenEdit = (product: Product) => {
    setEditing(product);
    setEditForm({
      title: product.title,
      vendor: product.vendor || "",
      status: product.status || "active",
      cost: product.cost != null ? String(product.cost) : "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;

    const cost = editForm.cost.trim();
    const parsedCost =
      cost !== "" && !Number.isNaN(Number(cost)) ? Number(cost) : undefined;

    setSaving(true);
    setError("");
    try {
      await updateProduct(token, editing.id, {
        title: editForm.title.trim(),
        vendor: editForm.vendor.trim() || undefined,
        status: editForm.status,
        cost: parsedCost,
      });
      setEditing(null);
      await loadProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handlePushToShopify = async (product: Product) => {
    if (!token || !shop) return;
    const price = window.prompt(`Price for "${product.title}":`, "0.00");
    if (price === null) return;
    const sku = window.prompt(`SKU for "${product.title}" (optional):`, "");
    if (sku === null) return;

    setError("");
    try {
      await createShopifyProduct(token, shop, {
        title: product.title,
        vendor: product.vendor || undefined,
        price: price.trim() || "0.00",
        sku: sku.trim() || undefined,
      });
      await loadProducts();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create on Shopify"
      );
    }
  };

  const handleAiDescribe = async (product: Product) => {
    if (!token) return;
    setAiModal(product);
    setAiResult(null);
    setAiLoading(true);
    try {
      const data = await aiDescribe(token, {
        title: product.title,
        vendor: product.vendor || undefined,
      });
      setAiResult(data as {
        description: string;
        seo_title: string;
        seo_description: string;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(false);
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
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Products</h2>
          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
            >
              {syncing ? "Syncing..." : "Sync from Shopify"}
            </button>
            <button
              onClick={() => router.push("/dashboard/import")}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition"
            >
              Bulk Import
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
            >
              {showAdd ? "Cancel" : "Add Product"}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Search products by title or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {selectedProducts.size > 0 && (
          <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
            <span className="text-sm text-gray-300">
              {selectedProducts.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="text-sm text-red-400 hover:text-red-300 transition"
            >
              Delete Selected
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4"
          >
            <h3 className="text-lg font-medium">Add Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Shopify Product ID"
                value={newProduct.shopify_product_id}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    shopify_product_id: e.target.value,
                  })
                }
                required
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Title"
                value={newProduct.title}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, title: e.target.value })
                }
                required
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Vendor (optional)"
                value={newProduct.vendor}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, vendor: e.target.value })
                }
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
            >
              Save Product
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">No products yet</p>
            <p className="text-sm">
              Click &quot;Sync from Shopify&quot; to import products, or add one
              manually.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="px-6 py-3 w-10"></th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Cost</th>
                  <th className="px-6 py-3">Shopify ID</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b border-gray-800 hover:bg-gray-800/50 ${
                      selectedProducts.has(product.id)
                        ? "bg-blue-900/20"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">{product.title}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {product.vendor || "--"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          product.status === "active"
                            ? "bg-green-900/50 text-green-400"
                            : product.status === "archived"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {product.status || "unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {product.cost != null ? `$${product.cost.toFixed(2)}` : "--"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {product.shopify_product_id}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="text-blue-400 hover:text-blue-300 text-sm transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleAiDescribe(product)}
                          className="text-purple-400 hover:text-purple-300 text-sm transition"
                        >
                          AI Describe
                        </button>
                        <button
                          onClick={() => handlePushToShopify(product)}
                          className="text-green-400 hover:text-green-300 text-sm transition"
                        >
                          Push to Shopify
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-400 hover:text-red-300 text-sm transition"
                        >
                          Delete
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

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Product</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Vendor (optional)</label>
                <input
                  type="text"
                  value={editForm.vendor}
                  onChange={(e) =>
                    setEditForm({ ...editForm, vendor: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">
                  Cost (used by repricing) (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.cost}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cost: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Description Modal */}
      {aiModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-purple-400">
                AI Description: {aiModal.title}
              </h3>
              <button
                onClick={() => setAiModal(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            {aiLoading && (
              <div className="text-center py-8 text-gray-400">
                Generating description...
              </div>
            )}

            {aiResult && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {aiResult.description}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">
                    SEO Title ({aiResult.seo_title.length}/60)
                  </h4>
                  <p className="text-white">{aiResult.seo_title}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">
                    Meta Description ({aiResult.seo_description.length}/160)
                  </h4>
                  <p className="text-white">{aiResult.seo_description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
