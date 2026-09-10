"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { importProductsFromCsv, downloadTemplate, syncProducts } from "@/lib/api";

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  imports: {
    row: number;
    title: string;
    shopify_product_id: number;
    status: string;
  }[];
  errors: { row: number; title: string; status: string; error: string }[];
}

export default function ImportPage() {
  const { token, shop, logout } = useAuth();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setResult(null);
    setError("");
  };

  const handleDownloadTemplate = async () => {
    setError("");
    try {
      await downloadTemplate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const handleImport = async () => {
    if (!token || !shop || !file) return;
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const data = (await importProductsFromCsv(token, shop, file)) as ImportResult;
      setResult(data);
      if (data.imported > 0) {
        await syncProducts(token, shop);
      }
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
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
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Bulk Import</h2>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition"
          >
            Download Template
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium">Upload CSV</h3>
          <p className="text-sm text-gray-400">
            Each row is created directly on Shopify. Supported columns:{" "}
            <code className="text-blue-400">
              title, vendor, price, cost, sku, product_type, tags, body_html, status
            </code>
            . Title is required. Use <code className="text-blue-400">cost</code>{" "}
            to enable margin-based repricing suggestions.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />

          {file && (
            <p className="text-sm text-gray-300">Selected: {file.name}</p>
          )}

          <button
            onClick={handleImport}
            disabled={importing || !file}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            {importing ? "Importing..." : "Import Products"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium">Import Results</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Total</p>
                <p className="text-2xl font-bold">{result.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Imported</p>
                <p className="text-2xl font-bold text-green-400">
                  {result.imported}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Failed</p>
                <p className="text-2xl font-bold text-red-400">
                  {result.failed}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border-t border-gray-800 pt-4">
                <p className="text-sm text-red-400 font-medium mb-2">
                  Errors ({result.errors.length})
                </p>
                <div className="space-y-2">
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      className="bg-red-900/20 border border-red-800 rounded px-3 py-2 text-sm"
                    >
                      <span className="text-gray-400">Row {err.row}:</span>{" "}
                      {err.title || "(no title)"} -{" "}
                      <span className="text-red-300">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}